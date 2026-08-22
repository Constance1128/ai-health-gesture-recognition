import numpy as np
import os

# ============================================================
# Configuration
# ============================================================
NUM_SAMPLES = 300      # samples per class
SEQ_LENGTH  = 30       # frames per sample
DIM_COORDS  = 99       # 33 joints × 3 (x, y, z)
DIM_FLOW    = 103      # 99 coords + 4 joint angles
DATA_DIR    = os.path.join(os.path.dirname(__file__), "data")

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def noise(shape, scale=0.005):
    return np.random.normal(0, scale, shape)

def save(name, X, y):
    path = os.path.join(DATA_DIR, name)
    idx = np.random.permutation(len(X))
    np.savez(path, X=X[idx].astype(np.float32), y=y[idx].astype(np.float32))
    print(f"  ✅ {name}: X={X.shape}  y={y.shape}")

# ============================================================
# 1. TREMOR DATASET  (Swin Transformer — binary classification)
#    label 0 = healthy  |  label 1 = tremor
#    Covers: Parkinson's rest tremor, Essential Tremor
# ============================================================
def generate_tremor_data():
    X, y = [], []
    t = np.linspace(0, 2 * np.pi, SEQ_LENGTH)

    # ── Healthy (smooth low-frequency sway) ──────────────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        seq[:, 12:15] += (np.sin(t) * 0.03)[:, None]   # R wrist
        seq[:, 21:24] += (np.sin(t) * 0.03)[:, None]   # L wrist
        seq += noise(seq.shape)
        X.append(seq); y.append(0)

    # ── Parkinson's rest tremor  (4–6 Hz, pill-rolling) ─────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        freq = np.random.uniform(4, 6)
        amp  = np.random.uniform(0.06, 0.14)
        tr   = np.sin(t * freq * 5) * amp
        seq[:, 12:15] += tr[:, None]
        seq[:, 21:24] += (tr * 0.6)[:, None]
        seq += noise(seq.shape, 0.01)
        X.append(seq); y.append(1)

    # ── Essential tremor  (8–12 Hz, action/postural) ────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        freq = np.random.uniform(8, 12)
        amp  = np.random.uniform(0.04, 0.10)
        tr   = np.sin(t * freq * 5) * amp
        seq[:, 12:15] += tr[:, None]        # R wrist
        seq[:, 9:12]  += (tr * 0.4)[:, None]  # R elbow slight
        seq += noise(seq.shape, 0.01)
        X.append(seq); y.append(1)

    save("tremor_dataset.npz", np.array(X), np.array(y))

# ============================================================
# 2. GAIT / SYMMETRY DATASET  (BiLSTM — regression 0→1)
#    label ~1.0 = symmetric  |  ~0.0 = asymmetric
#    Covers: Stroke/Hemiplegia, Cerebral Palsy, Gait Asymmetry
# ============================================================
def generate_gait_data():
    X, y = [], []
    t = np.linspace(0, 4 * np.pi, SEQ_LENGTH)

    # ── Symmetric healthy gait ───────────────────────────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        amp  = np.random.uniform(0.15, 0.25)
        ls   = np.sin(t) * amp
        rs   = np.sin(t + np.pi) * amp          # anti-phase
        seq[:, 3:6]  += ls[:, None]              # L shoulder
        seq[:, 6:9]  += rs[:, None]              # R shoulder
        seq[:, 33:36] += ls[:, None]             # L hip
        seq[:, 36:39] += rs[:, None]             # R hip
        seq += noise(seq.shape, 0.015)
        X.append(seq); y.append(np.random.uniform(0.88, 1.0))

    # ── Stroke / Hemiplegia (one-sided weakness, lag) ────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        strong = np.sin(t) * 0.20
        weak   = np.sin(t + np.pi + np.random.uniform(0.8, 1.8)) * 0.04
        seq[:, 3:6]  += strong[:, None]
        seq[:, 6:9]  += weak[:, None]
        seq += noise(seq.shape, 0.02)
        X.append(seq); y.append(np.random.uniform(0.05, 0.35))

    # ── Cerebral Palsy (spastic, jerky, reduced range) ───────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        base = np.sin(t) * 0.10
        jumps = np.zeros(SEQ_LENGTH)
        for idx in np.random.choice(range(3, 27), 5, replace=False):
            jumps[idx] = np.random.uniform(0.08, 0.20)
        seq[:, 3:6]  += (base + jumps)[:, None]
        seq[:, 6:9]  += (base * 0.5 + jumps * 0.3)[:, None]
        seq += noise(seq.shape, 0.02)
        X.append(seq); y.append(np.random.uniform(0.15, 0.45))

    # ── Leg Length Discrepancy (pelvic drop on one side) ─────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_COORDS))
        drop = np.random.uniform(0.04, 0.09)
        seq[:, 33:36] += noise((SEQ_LENGTH, 3), 0.01)    # L hip normal
        seq[:, 36:39] += noise((SEQ_LENGTH, 3), 0.01)    # R hip shifted
        seq[:, 36] += drop                                 # R hip lower
        seq += noise(seq.shape, 0.01)
        X.append(seq); y.append(np.random.uniform(0.30, 0.55))

    save("gait_dataset.npz", np.array(X), np.array(y))

# ============================================================
# 3. FLOW / POSTURE DATASET  (LSTM — regression 0→1)
#    label ~1.0 = smooth/normal  |  ~0.0 = stiff/abnormal
#    Covers: Frozen Shoulder, Kyphosis, Lordosis, Flat Back,
#            Knock Knees / Bow Legs, Scoliosis, Text Neck
# ============================================================
def generate_flow_data():
    X, y = [], []
    t = np.linspace(0, np.pi, SEQ_LENGTH)

    # ── Smooth / Normal posture ──────────────────────────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        smooth_angles = np.sin(t) * 90
        for i in range(4):
            seq[:, 99 + i] = smooth_angles + noise((SEQ_LENGTH,), 1.0)
        X.append(seq); y.append(np.random.uniform(0.82, 1.0))

    # ── Frozen Shoulder (very restricted arm range) ──────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        restricted = np.sin(t) * np.random.uniform(15, 35)   # tiny range
        seq[:, 99]  = restricted + noise((SEQ_LENGTH,), 1.5)  # L shoulder angle
        seq[:, 100] = restricted + noise((SEQ_LENGTH,), 1.5)  # R shoulder angle
        # Elbow angles normal since restriction is at shoulder
        seq[:, 101:103] = (np.sin(t) * 90)[:, None] + noise((SEQ_LENGTH, 2), 2.0)
        X.append(seq); y.append(np.random.uniform(0.05, 0.30))

    # ── Kyphosis (rounded upper back — shoulder drop forward) ─
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        # Spine coord feature: shoulders pushed forward (x offset)
        kyphosis_offset = np.random.uniform(0.06, 0.14)
        seq[:, 3:6] += kyphosis_offset    # L shoulder x shifted
        seq[:, 6:9] += kyphosis_offset    # R shoulder x shifted
        for i in range(4):
            seq[:, 99 + i] = np.sin(t) * 60 + noise((SEQ_LENGTH,), 3.0)
        X.append(seq); y.append(np.random.uniform(0.15, 0.40))

    # ── Lordosis (excessive lumbar arch — hips tilt forward) ──
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        lordosis_offset = np.random.uniform(0.05, 0.12)
        seq[:, 33:36] -= lordosis_offset   # L hip pushed forward
        seq[:, 36:39] -= lordosis_offset   # R hip pushed forward
        for i in range(4):
            seq[:, 99 + i] = np.sin(t) * 100 + noise((SEQ_LENGTH,), 2.0)
        X.append(seq); y.append(np.random.uniform(0.20, 0.45))

    # ── Flat Back (reduced spinal curves — hips neutral) ──────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        # Very small variation in spinal movement (stiff, flat)
        for i in range(4):
            seq[:, 99 + i] = np.random.uniform(85, 95) + noise((SEQ_LENGTH,), 0.5)
        X.append(seq); y.append(np.random.uniform(0.30, 0.50))

    # ── Knock Knees / Genu Valgum (knees angle inward) ───────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        valgus = np.random.uniform(0.04, 0.10)
        seq[:, 75:78] += valgus   # L knee x shifted inward
        seq[:, 78:81] -= valgus   # R knee x shifted inward
        for i in range(2):
            seq[:, 101 + i] = np.sin(t) * 150 + noise((SEQ_LENGTH,), 3.0)  # knee angles abnormal
        X.append(seq); y.append(np.random.uniform(0.15, 0.45))

    # ── Bow Legs / Genu Varum (knees angle outward) ───────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        varus = np.random.uniform(0.04, 0.10)
        seq[:, 75:78] -= varus    # L knee x shifted outward
        seq[:, 78:81] += varus    # R knee x shifted outward
        for i in range(2):
            seq[:, 101 + i] = np.sin(t) * 155 + noise((SEQ_LENGTH,), 3.0)
        X.append(seq); y.append(np.random.uniform(0.15, 0.45))

    # ── Scoliosis (lateral spinal curve — spine angle) ────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        lateral = np.random.uniform(0.05, 0.13)
        seq[:, 3:6]  += lateral    # L shoulder higher/shifted
        seq[:, 36:39] -= lateral   # R hip lower/shifted
        for i in range(4):
            seq[:, 99 + i] = np.sin(t) * 80 + noise((SEQ_LENGTH,), 2.0)
        X.append(seq); y.append(np.random.uniform(0.10, 0.40))

    # ── Text Neck / Forward Head Posture ──────────────────────
    for _ in range(NUM_SAMPLES):
        seq = np.zeros((SEQ_LENGTH, DIM_FLOW))
        head_forward = np.random.uniform(0.05, 0.12)
        seq[:, 0:3] += head_forward    # nose x offset forward
        seq[:, 99]   = np.sin(t) * 40 + noise((SEQ_LENGTH,), 2.0)  # neck angle reduced
        X.append(seq); y.append(np.random.uniform(0.10, 0.40))

    save("flow_dataset.npz", np.array(X), np.array(y))

if __name__ == "__main__":
    print("\n📊 Generating Expanded Health Detection Datasets...")
    print(f"   Samples/class: {NUM_SAMPLES}  |  Seq length: {SEQ_LENGTH} frames\n")
    ensure_dir(DATA_DIR)
    generate_tremor_data()
    generate_gait_data()
    generate_flow_data()
    print(f"\n✅ All datasets saved to: {DATA_DIR}")
    print("🚀 Run 'python train.py' next to train all 3 models!")
