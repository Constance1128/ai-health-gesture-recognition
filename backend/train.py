import os
import numpy as np

try:
    import tensorflow as tf
    print(f"✅ TensorFlow {tf.__version__} loaded (CPU training)")
except ImportError:
    print("❌ TensorFlow not installed! Run: pip install tensorflow-cpu")
    exit(1)

from ai_models import SwinTransformerClassifier, BiLSTMGaitAnalyzer
from models.temporal_network import TemporalFlowNetwork

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def load_data(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print(f"❌ Dataset not found: {path}. Please run generate_dataset.py first!")
        exit(1)
    data = np.load(path)
    return data['X'], data['y']

def train_models():
    ensure_dir(WEIGHTS_DIR)
    
    print("\n========================================")
    print("1. Training Tremor Classifier (Swin)")
    print("========================================")
    X_tremor, y_tremor = load_data("tremor_dataset.npz")
    print(f"   Dataset shape: X={X_tremor.shape}, y={y_tremor.shape}")
    tremor_model = SwinTransformerClassifier()
    tremor_model.model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    tremor_model.model.fit(X_tremor, y_tremor, epochs=15, batch_size=32, validation_split=0.2, verbose=1)
    tremor_weights_path = os.path.join(WEIGHTS_DIR, "tremor_model.weights.h5")
    tremor_model.model.save_weights(tremor_weights_path)
    print(f"✅ Tremor weights saved to {tremor_weights_path}\n")
    
    print("========================================")
    print("2. Training Gait Analyzer (BiLSTM)")
    print("========================================")
    X_gait, y_gait = load_data("gait_dataset.npz")
    print(f"   Dataset shape: X={X_gait.shape}, y={y_gait.shape}")
    gait_model = BiLSTMGaitAnalyzer()
    gait_model.model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    gait_model.model.fit(X_gait, y_gait, epochs=20, batch_size=32, validation_split=0.2, verbose=1)
    gait_weights_path = os.path.join(WEIGHTS_DIR, "gait_model.weights.h5")
    gait_model.model.save_weights(gait_weights_path)
    print(f"✅ Gait weights saved to {gait_weights_path}\n")
    
    print("========================================")
    print("3. Training Temporal Flow Network (LSTM)")
    print("========================================")
    X_flow, y_flow = load_data("flow_dataset.npz")
    print(f"   Dataset shape: X={X_flow.shape}, y={y_flow.shape}")
    flow_model = TemporalFlowNetwork()
    flow_model.model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    flow_model.model.fit(X_flow, y_flow, epochs=20, batch_size=32, validation_split=0.2, verbose=1)
    flow_weights_path = os.path.join(WEIGHTS_DIR, "flow_model.weights.h5")
    flow_model.model.save_weights(flow_weights_path)
    print(f"✅ Flow weights saved to {flow_weights_path}\n")
    
    print("🎉 All models trained! Backend will now use these weights for real AI inference.")

if __name__ == "__main__":
    train_models()
