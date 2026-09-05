import { JointPoint } from '../types';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface PostureSnapshot {
  timestamp: number;
  nose?: JointPoint;
  leftShoulder?: JointPoint;
  rightShoulder?: JointPoint;
  leftElbow?: JointPoint;
  rightElbow?: JointPoint;
  leftWrist?: JointPoint;
  rightWrist?: JointPoint;
  leftHip?: JointPoint;
  rightHip?: JointPoint;
  leftKnee?: JointPoint;
  rightKnee?: JointPoint;
  leftAnkle?: JointPoint;
  rightAnkle?: JointPoint;
}

export interface PostureFinding {
  id: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  label: string;
  description: string;
  affectedArea: string;
}

export interface PossibleCondition {
  name: string;
  risk: 'low' | 'moderate' | 'high';
  probability: number; // 0-100
  description: string;
}

export interface JointAngleMeasurement {
  joint: string;
  description: string;
  measured: number;
  normalMin: number;
  normalMax: number;
  unit: string;
  status: 'normal' | 'mild' | 'moderate' | 'severe';
}

export interface DiagnosisReport {
  score: number; // 0-100
  grade: string; // A+, A, B+, B, C+, C, D
  status: string; // "Excellent", "Good", "Fair", "Poor"
  findings: PostureFinding[];
  conditions: PossibleCondition[];
  measurements: JointAngleMeasurement[];
  summary: string;
  recommendation: string;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function calcAngle(p1: JointPoint, p2: JointPoint, p3: JointPoint): number {
  const radians =
    Math.atan2(p3.y - p2.y, p3.x - p2.x) -
    Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

// We use the 85th percentile rather than the mean average. 
// This prevents brief moments of good posture from mathematically "diluting" the detection of bad posture held for a few seconds.
function getRepresentativeValue(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.85);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function getSeverityLabel(deviation: number, mild: number, moderate: number, severe: number): 'normal' | 'mild' | 'moderate' | 'severe' {
  if (deviation < mild) return 'normal';
  if (deviation < moderate) return 'mild';
  if (deviation < severe) return 'moderate';
  return 'severe';
}

function gradeFromScore(score: number): { grade: string; status: string } {
  if (score >= 90) return { grade: 'A+', status: 'Excellent' };
  if (score >= 80) return { grade: 'A', status: 'Very Good' };
  if (score >= 70) return { grade: 'B+', status: 'Good' };
  if (score >= 60) return { grade: 'B', status: 'Fair' };
  if (score >= 50) return { grade: 'C+', status: 'Below Average' };
  if (score >= 40) return { grade: 'C', status: 'Poor' };
  return { grade: 'D', status: 'Needs Attention' };
}

// ────────────────────────────────────────────
// Snapshot builder from landmarks array
// ────────────────────────────────────────────

export function buildSnapshot(landmarks: JointPoint[]): PostureSnapshot {
  return {
    timestamp: Date.now(),
    nose: landmarks[0],
    leftShoulder: landmarks[11],
    rightShoulder: landmarks[12],
    leftElbow: landmarks[13],
    rightElbow: landmarks[14],
    leftWrist: landmarks[15],
    rightWrist: landmarks[16],
    leftHip: landmarks[23],
    rightHip: landmarks[24],
    leftKnee: landmarks[25],
    rightKnee: landmarks[26],
    leftAnkle: landmarks[27],
    rightAnkle: landmarks[28],
  };
}

// ────────────────────────────────────────────
// Main diagnosis engine
// ────────────────────────────────────────────

export function generateDiagnosis(snapshots: PostureSnapshot[], analysisResult: any = null): DiagnosisReport {
  if (snapshots.length === 0) {
    return {
      score: 0,
      grade: 'N/A',
      status: 'Insufficient Data',
      findings: [],
      conditions: [],
      measurements: [],
      summary: 'Not enough data was collected to generate a diagnosis.',
      recommendation: 'Please complete a full screening session to receive a posture analysis.',
    };
  }

  try {
    // ── 1. Collect metrics across frames ──────
    const shoulderAsymmetries: number[] = [];
    const hipTilts: number[] = [];
    const headForwardOffsets: number[] = [];
    const leftElbowAngles: number[] = [];
    const rightElbowAngles: number[] = [];
    const leftKneeAngles: number[] = [];
    const rightKneeAngles: number[] = [];
    const spineAngles: number[] = []; // rough vertical alignment

    snapshots.forEach(s => {
      const { nose, leftShoulder, rightShoulder, leftElbow, leftWrist, rightElbow, rightWrist, leftHip, rightHip, leftKnee, leftAnkle, rightKnee, rightAnkle } = s;

      // Shoulder height asymmetry (in normalised coords, multiply by 100 for "percent of frame")
      if (leftShoulder && rightShoulder &&
        (leftShoulder.visibility ?? 1) > 0.3 &&
        (rightShoulder.visibility ?? 1) > 0.3) {
        const diff = Math.abs(leftShoulder.y - rightShoulder.y) * 100;
        shoulderAsymmetries.push(diff);

        // Head forward posture: nose X vs midpoint of shoulders
        if (nose && (nose.visibility ?? 1) > 0.3) {
          const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
          const offset = Math.abs(nose.x - midShoulderX) * 100;
          headForwardOffsets.push(offset);
        }

        // Spine angle: deviation of midpoint-shoulder from midpoint-hip vertical axis
        if (leftHip && rightHip && (leftHip.visibility ?? 1) > 0.3 && (rightHip.visibility ?? 1) > 0.3) {
          const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
          const midHipX = (leftHip.x + rightHip.x) / 2;
          const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          const midHipY = (leftHip.y + rightHip.y) / 2;
          const dx = midShoulderX - midHipX;
          const dy = midHipY - midShoulderY; // positive when shoulders above hips
          const spineAngle = Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));
          spineAngles.push(spineAngle);

          // Hip tilt
          const hipDiff = Math.abs(leftHip.y - rightHip.y) * 100;
          hipTilts.push(hipDiff);
        }
      }

      // Elbow angles
      if (leftShoulder && leftElbow && leftWrist &&
        (leftShoulder.visibility ?? 1) > 0.2 && (leftElbow.visibility ?? 1) > 0.2 && (leftWrist.visibility ?? 1) > 0.2) {
        leftElbowAngles.push(calcAngle(leftShoulder, leftElbow, leftWrist));
      }
      if (rightShoulder && rightElbow && rightWrist &&
        (rightShoulder.visibility ?? 1) > 0.2 && (rightElbow.visibility ?? 1) > 0.2 && (rightWrist.visibility ?? 1) > 0.2) {
        rightElbowAngles.push(calcAngle(rightShoulder, rightElbow, rightWrist));
      }

      // Knee angles
      if (leftHip && leftKnee && leftAnkle &&
        (leftHip.visibility ?? 1) > 0.2 && (leftKnee.visibility ?? 1) > 0.2 && (leftAnkle.visibility ?? 1) > 0.2) {
        leftKneeAngles.push(calcAngle(leftHip, leftKnee, leftAnkle));
      }
      if (rightHip && rightKnee && rightAnkle &&
        (rightHip.visibility ?? 1) > 0.2 && (rightKnee.visibility ?? 1) > 0.2 && (rightAnkle.visibility ?? 1) > 0.2) {
        rightKneeAngles.push(calcAngle(rightHip, rightKnee, rightAnkle));
      }
    });

    // ── 2. Compute averages ──────────────────
    const avgShoulderAsymmetry = getRepresentativeValue(shoulderAsymmetries);
    const avgHipTilt = getRepresentativeValue(hipTilts);
    const avgHeadOffset = getRepresentativeValue(headForwardOffsets);
    const avgSpineAngle = getRepresentativeValue(spineAngles);
    const avgLeftElbow = getRepresentativeValue(leftElbowAngles);
    const avgRightElbow = getRepresentativeValue(rightElbowAngles);
    const avgLeftKnee = getRepresentativeValue(leftKneeAngles);
    const avgRightKnee = getRepresentativeValue(rightKneeAngles);

    console.log('[Diagnosis] Calculated Averages:', {
      avgShoulderAsymmetry,
      avgHipTilt,
      avgHeadOffset,
      avgSpineAngle,
      avgLeftElbow,
      avgRightElbow,
      avgLeftKnee,
      avgRightKnee
    });

    // ── 3. Build findings ────────────────────
    const findings: PostureFinding[] = [];

    // Shoulder asymmetry (threshold: mild >0.8%, moderate >2.5%, severe >5%)
    const shoulderSev = getSeverityLabel(avgShoulderAsymmetry, 0.8, 2.5, 5);
    if (shoulderSev !== 'normal') {
      findings.push({
        id: 'shoulder-asymmetry',
        severity: shoulderSev,
        label: 'Shoulder Level Difference',
        affectedArea: 'Shoulders',
        description: `Your left and right shoulders are at different heights (${avgShoulderAsymmetry.toFixed(1)}% difference). This may indicate ${shoulderSev === 'severe' ? 'significant scoliosis or muscle imbalance' : shoulderSev === 'moderate' ? 'mild scoliosis or chronic posture habits' : 'minor posture imbalance or muscle tightness'}.`,
      });
    }

    // Hip tilt (threshold: mild >0.8%, moderate >2.5%, severe >5%)
    const hipSev = getSeverityLabel(avgHipTilt, 0.8, 2.5, 5);
    if (hipSev !== 'normal') {
      findings.push({
        id: 'hip-tilt',
        severity: hipSev,
        label: 'Pelvic Tilt Detected',
        affectedArea: 'Hips / Pelvis',
        description: `Uneven hip height detected (${avgHipTilt.toFixed(1)}% tilt). ${hipSev === 'severe' ? 'Significant pelvic tilt may lead to lower back pain and gait asymmetry.' : hipSev === 'moderate' ? 'Moderate pelvic tilt often relates to leg length discrepancy or hip flexor tightness.' : 'Slight pelvic tilt may be due to standing posture habits.'}`,
      });
    }

    // Forward head / spine lean (threshold: mild >1.5°, moderate >3.5°, severe >6°)
    const spineSev = getSeverityLabel(avgSpineAngle, 1.5, 3.5, 6);
    if (spineSev !== 'normal') {
      findings.push({
        id: 'spine-misalignment',
        severity: spineSev,
        label: 'Spine Lateral Misalignment',
        affectedArea: 'Spine / Torso',
        description: `The spine shows a lateral lean of approximately ${avgSpineAngle.toFixed(1)}°. ${spineSev === 'severe' ? 'This level of misalignment may indicate scoliosis or significant postural dysfunction.' : spineSev === 'moderate' ? 'Moderate curvature may relate to prolonged poor sitting habits or muscle imbalance.' : 'Minor spine lean is common and often correctable with targeted exercises.'}`,
      });
    }

    // Head offset (threshold: mild >1.0%, moderate >3.0%, severe >6.0%)
    const headSev = getSeverityLabel(avgHeadOffset, 1.0, 3.0, 6.0);
    if (headSev !== 'normal') {
      findings.push({
        id: 'head-position',
        severity: headSev,
        label: 'Head Position Offset',
        affectedArea: 'Neck / Cervical',
        description: `Head is offset laterally from the body center by ${avgHeadOffset.toFixed(1)}%. ${headSev === 'severe' ? 'Severe head offset can cause chronic neck strain and cervical nerve compression.' : headSev === 'moderate' ? 'Moderate head tilt may indicate cervical muscle imbalance or habitual head position.' : 'Slight head position offset detected, likely correctable with posture awareness.'}`,
      });
    }

    // If no issues found, add a positive finding
    if (findings.length === 0) {
      findings.push({
        id: 'normal-posture',
        severity: 'normal',
        label: 'Posture Within Normal Range',
        affectedArea: 'Full Body',
        description: 'No significant postural abnormalities were detected. Your body alignment appears to be within acceptable clinical ranges. Continue maintaining good posture habits.',
      });
    }

    // ── 4. Build conditions ──────────────────────────────────
    const conditions: PossibleCondition[] = [];

    // ── Scoliosis (shoulder + hip + spine asymmetry) ─────────
    const scoliosisRisk = clamp(
      Math.round((avgShoulderAsymmetry * 6) + (avgHipTilt * 5) + (avgSpineAngle * 4)),
      0, 100
    );
    if (scoliosisRisk > 15) {
      conditions.push({
        name: 'Scoliosis (Spinal Curvature)',
        risk: scoliosisRisk > 60 ? 'high' : scoliosisRisk > 35 ? 'moderate' : 'low',
        probability: scoliosisRisk,
        description: 'Lateral curvature of the spine. Indicated by shoulder/hip asymmetry and spine lateral lean.',
      });
    }

    // ── Forward Head Posture / Text Neck ─────────────────────
    const fhpRisk = clamp(Math.round(avgHeadOffset * 8), 0, 100);
    if (fhpRisk > 20) {
      conditions.push({
        name: 'Text Neck / Forward Head Posture',
        risk: fhpRisk > 65 ? 'high' : fhpRisk > 40 ? 'moderate' : 'low',
        probability: fhpRisk,
        description: 'Head positioned forward of the body center. Increases strain on the cervical spine and neck muscles. Common from prolonged phone/computer use.',
      });
    }

    // ── Pelvic Imbalance / Leg Length Discrepancy ─────────────
    const pelvicRisk = clamp(Math.round(avgHipTilt * 12), 0, 100);
    if (pelvicRisk > 20) {
      conditions.push({
        name: 'Pelvic Imbalance / Leg Length Discrepancy',
        risk: pelvicRisk > 60 ? 'high' : pelvicRisk > 35 ? 'moderate' : 'low',
        probability: pelvicRisk,
        description: 'Unequal hip height may indicate leg length discrepancy, hip flexor tightness, or structural pelvic imbalance.',
      });
    }

    // ── Kyphosis (rounded upper back) ─────────────────────────
    const kyphosisRisk = clamp(Math.round((avgSpineAngle * 5) + (avgShoulderAsymmetry * 3)), 0, 100);
    if (kyphosisRisk > 20) {
      conditions.push({
        name: 'Postural Kyphosis (Rounded Shoulders / Hunchback)',
        risk: kyphosisRisk > 65 ? 'high' : kyphosisRisk > 40 ? 'moderate' : 'low',
        probability: kyphosisRisk,
        description: 'Excessive forward rounding of the upper back. Commonly caused by prolonged sitting, weak upper back muscles, or Scheuermann\'s disease.',
      });
    }

    // ── Lordosis (excessive lower back curve) ─────────────────
    // Proxy: large hip tilt with forward trunk lean
    const lordosisRisk = clamp(Math.round(avgHipTilt * 8 + avgSpineAngle * 2), 0, 100);
    if (lordosisRisk > 25 && avgHipTilt > 3) {
      conditions.push({
        name: 'Lordosis (Excessive Lumbar Arch)',
        risk: lordosisRisk > 60 ? 'high' : lordosisRisk > 35 ? 'moderate' : 'low',
        probability: lordosisRisk,
        description: 'Excessive inward curvature of the lower spine. Often caused by weak core muscles, tight hip flexors, or obesity. Can lead to lower back pain.',
      });
    }

    // ── Flat Back Syndrome ────────────────────────────────────
    // Proxy: very small spine angle variation (abnormally straight)
    const flatBackRisk = clamp(Math.round(Math.max(0, 5 - avgSpineAngle) * 10), 0, 60);
    if (flatBackRisk > 25 && avgShoulderAsymmetry < 2 && avgSpineAngle < 2) {
      conditions.push({
        name: 'Flat Back Syndrome',
        risk: 'low',
        probability: flatBackRisk,
        description: 'Reduced natural spinal curves making the back appear unusually straight. Can cause difficulty standing for long periods and lower back fatigue.',
      });
    }

    // ── Frozen Shoulder / Adhesive Capsulitis ─────────────────
    const avgElbowDiff = Math.abs((avgLeftElbow || 0) - (avgRightElbow || 0));
    const frozenShoulderRisk = clamp(Math.round(avgElbowDiff * 2 + avgShoulderAsymmetry * 4), 0, 100);
    if (frozenShoulderRisk > 25 && avgElbowDiff > 15) {
      conditions.push({
        name: 'Frozen Shoulder (Adhesive Capsulitis)',
        risk: frozenShoulderRisk > 60 ? 'high' : frozenShoulderRisk > 35 ? 'moderate' : 'low',
        probability: frozenShoulderRisk,
        description: 'Significant asymmetry between left and right arm range of motion detected. May indicate restricted shoulder joint movement on one side.',
      });
    }

    // ── Knock Knees (Genu Valgum) ─────────────────────────────
    const avgKneeDiff = Math.abs((avgLeftKnee || 0) - (avgRightKnee || 0));
    const knockKneeRisk = clamp(Math.round(avgKneeDiff * 2.5 + avgHipTilt * 3), 0, 100);
    if (knockKneeRisk > 25 && avgKneeDiff > 10) {
      conditions.push({
        name: 'Knock Knees / Bow Legs (Knee Alignment)',
        risk: knockKneeRisk > 60 ? 'high' : knockKneeRisk > 35 ? 'moderate' : 'low',
        probability: knockKneeRisk,
        description: 'Asymmetric knee joint angles detected. May indicate genu valgum (knock knees) or genu varum (bow legs). Can lead to knee pain and early arthritis.',
      });
    }

    // ── Stroke Recovery / Hemiplegia ──────────────────────────
    const hemiplegiaRisk = clamp(
      Math.round((avgShoulderAsymmetry * 5) + (avgHipTilt * 4) + (avgElbowDiff * 1.5)),
      0, 100
    );
    if (hemiplegiaRisk > 35) {
      conditions.push({
        name: 'Stroke Recovery / Hemiplegia Indicators',
        risk: hemiplegiaRisk > 65 ? 'high' : hemiplegiaRisk > 45 ? 'moderate' : 'low',
        probability: hemiplegiaRisk,
        description: 'Significant left-right asymmetry across multiple joints detected. This pattern may indicate post-stroke weakness on one side of the body. Consult a neurologist.',
      });
    }

    // ── Parkinson's Disease ─────────────────────────────────────────────
    // Computed PURELY from the 50ms wrist snapshots collected during this session.
    // We do NOT inherit backend.tremor_prob here because the backend session history
    // accumulates old frames across multiple assessments and produces false positives.
    let frontendTremorScoreOverride: number | undefined = undefined;
    let tremorProb = 0; // Always start fresh — never inherit backend value
    const backendTremorProb = analysisResult?.metrics?.tremor_prob || 0;
    const statusText = (analysisResult?.status || '').toLowerCase();

    if (snapshots.length > 4) {
      const calcVar = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
      };

      // Extract raw coordinates. We don't filter by visibility here because fast shakes cause motion blur
      // which artificially drops MediaPipe's visibility score. Instead, we just filter out EXACT 0,0
      // which indicates the joint is completely missing from the frame (or fell back to our ?? 0).
      const lx = snapshots.map(s => s.leftWrist?.x ?? 0).filter(v => v !== 0);
      const ly = snapshots.map(s => s.leftWrist?.y ?? 0).filter(v => v !== 0);
      const rx = snapshots.map(s => s.rightWrist?.x ?? 0).filter(v => v !== 0);
      const ry = snapshots.map(s => s.rightWrist?.y ?? 0).filter(v => v !== 0);

      const lVarX = calcVar(lx), lVarY = calcVar(ly);
      const rVarX = calcVar(rx), rVarY = calcVar(ry);

      // Use the MAX variance across both wrists and both axes.
      // Parkinson's tremor typically appears in X (side-to-side) OR Y (up-down)
      // whichever is dominant. We take the worst case.
      const maxVar = Math.max(lVarX, lVarY, rVarX, rVarY);

      // Velocity logic (acceleration variance) to filter out smooth macro-movements
      const calcVelVar = (arr: number[]) => {
        if (arr.length < 2) return 0;
        const diffs = [];
        for (let i = 1; i < arr.length; i++) {
          const diff = arr[i] - arr[i - 1];
          // GLITCH FILTER: Ignore massive jumps (MediaPipe tracking errors)
          if (Math.abs(diff) < 0.50) {
            diffs.push(diff);
          }
        }
        return calcVar(diffs);
      };

      const lAccX = calcVelVar(lx), lAccY = calcVelVar(ly);
      const rAccX = calcVelVar(rx), rAccY = calcVelVar(ry);

      // We take the max acceleration variance. Smooth movements have 0 acceleration variance.
      const maxAcc = Math.max(lAccX, lAccY, rAccX, rAccY);

      // DEBUG — visible in browser DevTools console
      console.log('[TremorDetect] snapshots:', snapshots.length,
        '| maxVar (spatial):', maxVar.toFixed(6),
        '| maxAcc (velocity var):', maxAcc.toFixed(6),
        '| sessionMaxTremorProb:', (analysisResult?.metrics?.session_max_tremor_prob || 0).toFixed(3));

      // 0.00002 safely filters out standard 1080p webcam static noise.
      if (maxAcc >= 0.00002) {
        // Smooth scale: 0.00002 -> 0.10 (Normal), 0.00008 -> 0.40 (Mild), 0.00015+ -> 0.75+ (Parkinson's)
        tremorProb = Math.min(0.95, (maxAcc - 0.00002) * 5000.0 + 0.10);
      }

      // Frontend calculates the tremor directly from 50ms snapshots.
      // We no longer inherit the backend's max probability because the backend runs at 5 FPS,
      // which causes normal macro-movements to alias as tremors and trigger false positives.
    } else if (analysisResult?.mode === 'tremor') {
      // Fallback for tremor-mode only: use backend value directly
      tremorProb = backendTremorProb;
    }

    if (tremorProb > 0.35) {
      conditions.push({
        name: "Parkinson's Disease (Resting Tremor)",
        risk: tremorProb > 0.65 ? 'high' : 'moderate',
        probability: Math.round(tremorProb * 100),
        description: 'Involuntary oscillatory tremor detected in wrist/hand motion. Pattern matches Parkinsonian resting tremor characteristics. Clinical neurological evaluation is recommended.',
      });

      frontendTremorScoreOverride = Math.max(25, Math.round(100 - (tremorProb * 65.0)));
    }

    // ── Cerebral Palsy Indicators ────────────────────────────
    // We strictly use Knee and Shoulder asymmetry. 
    // We DO NOT use Elbow asymmetry because users standing casually with one hand on their hip will trigger CP!
    const cpRisk = clamp(
      Math.round((avgKneeDiff * 2.5) + (avgShoulderAsymmetry * 4.0)),
      0, 100
    );
    if (cpRisk > 40) {
      conditions.push({
        name: 'Cerebral Palsy / Spasticity Indicators',
        risk: cpRisk > 65 ? 'high' : cpRisk > 45 ? 'moderate' : 'low',
        probability: cpRisk,
        description: 'Irregular asymmetric joint movement patterns detected across multiple limbs. This may indicate spastic movement disorder. Medical evaluation recommended.',
      });
    }

    // ── Essential Tremor (elbow variance proxy) ──────────────────────────
    // Only show if NOT already diagnosed as Parkinson's (which is higher-confidence)
    if (avgElbowDiff > 20 && avgShoulderAsymmetry < 3 && tremorProb < 0.35) {
      conditions.push({
        name: 'Essential Tremor (Possible)',
        risk: 'low',
        probability: clamp(Math.round(avgElbowDiff * 2), 0, 60),
        description: 'Minor asymmetric arm positioning detected. Essential tremor is an action tremor — a neurologist assessment with specific hand/arm movement tests is needed to confirm.',
      });
    }

    // ── Muscular Dystrophy Indicators ────────────────────────────────
    const mdRisk = clamp(Math.round((avgShoulderAsymmetry * 2) + (avgElbowDiff * 1.5) + (avgSpineAngle * 3)), 0, 100);
    if (mdRisk > 30 && avgShoulderAsymmetry > 2 && avgElbowDiff > 10 && avgHipTilt > 1.5) {
      conditions.push({
        name: 'Muscular Dystrophy / Proximal Weakness',
        risk: mdRisk > 60 ? 'high' : mdRisk > 40 ? 'moderate' : 'low',
        probability: mdRisk,
        description: 'Symmetric proximal muscle weakness pattern detected — drooping shoulders, limited elbow extension, and trunk lean. May be consistent with progressive muscular dystrophy. Neuromuscular specialist evaluation needed.',
      });
    }

    // ── Multiple Sclerosis Motor Signs ──────────────────────────────
    const msRisk = clamp(Math.round((avgShoulderAsymmetry * 3) + (avgKneeDiff * 2) + (avgElbowDiff * 1.5) + (avgHipTilt * 2)), 0, 100);
    if (msRisk > 35 && avgShoulderAsymmetry > 2.5 && avgKneeDiff > 8) {
      conditions.push({
        name: 'Multiple Sclerosis Motor Signs (Possible)',
        risk: msRisk > 60 ? 'high' : 'moderate',
        probability: msRisk,
        description: 'Asymmetric upper and lower limb motor discrepancy detected. This pattern may reflect demyelination-related motor dysfunction. Brain and spinal MRI required to rule out MS.',
      });
    }

    // ── Rheumatoid Arthritis ────────────────────────────────────────
    const raRisk = clamp(Math.round((avgElbowDiff * 3) + (avgShoulderAsymmetry * 2)), 0, 100);
    if (raRisk > 30 && avgElbowDiff > 15) {
      conditions.push({
        name: 'Rheumatoid Arthritis / Inflammatory Arthropathy',
        risk: raRisk > 60 ? 'high' : 'moderate',
        probability: raRisk,
        description: 'Significant asymmetric restriction in elbow and shoulder joint range-of-motion. Joint inflammation consistent with inflammatory arthritis. Rheumatology referral recommended.',
      });
    }

    // ── Torticollis / Cervical Radiculopathy ───────────────────────
    const torticollisRisk = clamp(Math.round((avgHeadOffset * 8) + (avgShoulderAsymmetry * 4)), 0, 100);
    if (torticollisRisk > 30 && avgHeadOffset > 3 && avgShoulderAsymmetry > 2) {
      conditions.push({
        name: 'Torticollis / Cervical Radiculopathy',
        risk: torticollisRisk > 60 ? 'high' : 'moderate',
        probability: torticollisRisk,
        description: 'Head lateral tilt combined with unilateral shoulder elevation detected. May indicate muscle spasm (torticollis) or nerve root compression in the cervical spine.',
      });
    }

    // ── Spinal Stenosis ──────────────────────────────────────────
    const stenosisRisk = clamp(Math.round((avgSpineAngle * 6) + (avgHipTilt * 5)), 0, 100);
    if (stenosisRisk > 35 && avgSpineAngle > 4 && avgHipTilt > 2.5) {
      conditions.push({
        name: 'Spinal Stenosis / Lumbar Instability',
        risk: stenosisRisk > 65 ? 'high' : 'moderate',
        probability: stenosisRisk,
        description: 'Forward trunk lean with compensatory hip tilt detected — a common adaptation to spinal canal narrowing. Lumbar MRI and orthopaedic spine consultation recommended.',
      });
    }

    // ── Shoulder Impingement Syndrome ─────────────────────────────
    const impingementRisk = clamp(Math.round((avgShoulderAsymmetry * 6) + (avgElbowDiff * 2)), 0, 100);
    if (impingementRisk > 30 && avgShoulderAsymmetry > 2.5 && avgElbowDiff > 12) {
      conditions.push({
        name: 'Shoulder Impingement Syndrome',
        risk: impingementRisk > 60 ? 'high' : 'moderate',
        probability: impingementRisk,
        description: 'Elevated shoulder with restricted ipsilateral arm motion detected. May indicate rotator cuff impingement or subacromial bursitis. Ultrasound and physiotherapy assessment recommended.',
      });
    }

    // ── Build Illness / Syndrome Findings into findings array ──────
    const illnessFindings: PostureFinding[] = [];

    // Parkinson's / Tremor — only show when conditions section is also triggered (> 0.35)
    if (tremorProb > 0.35 || statusText.includes('parkinson') || statusText.includes('tremor')) {
      const tremorFreq = analysisResult?.metrics?.tremor_freq || analysisResult?.metrics?.frequency_hz || 5.0;
      const isParkinsons = statusText.includes('parkinson') || (tremorFreq >= 3.0 && tremorFreq <= 6.5);

      if (isParkinsons) {
        illnessFindings.push({
          id: 'parkinsons-disease',
          severity: tremorProb > 0.5 ? 'severe' : 'moderate',
          label: "Parkinson's Disease (Resting Tremor)",
          affectedArea: 'Neurological / Motor Control',
          description: `Resting tremor detected (${tremorFreq > 0 ? `${tremorFreq.toFixed(1)} Hz` : '4-6 Hz range'}) in hands/wrists, matching Parkinsonian motor symptoms.`
        });
      } else {
        illnessFindings.push({
          id: 'essential-tremor',
          severity: tremorProb > 0.6 ? 'severe' : 'moderate',
          label: 'Essential Tremor (Action Tremor)',
          affectedArea: 'Neurological / Motor Control',
          description: `Tremor oscillations detected (${tremorFreq > 0 ? `${tremorFreq.toFixed(1)} Hz` : 'high frequency'}) during active posture holding.`
        });
      }
    }

    // Stroke / Hemiplegia
    if (hemiplegiaRisk > 35 || (analysisResult?.status && (analysisResult.status.toLowerCase().includes('stroke') || analysisResult.status.toLowerCase().includes('hemiplegia')))) {
      illnessFindings.push({
        id: 'stroke-hemiplegia',
        severity: hemiplegiaRisk > 60 ? 'severe' : 'moderate',
        label: 'Stroke / Hemiplegia Syndrome',
        affectedArea: 'Bilateral Symmetry / Motor Function',
        description: 'Significant unilateral asymmetry and movement lag detected between left and right sides.'
      });
    }

    // Scoliosis
    if (scoliosisRisk > 30 || (analysisResult?.status && analysisResult.status.toLowerCase().includes('scoliosis'))) {
      illnessFindings.push({
        id: 'scoliosis-syndrome',
        severity: scoliosisRisk > 60 ? 'severe' : 'moderate',
        label: 'Scoliosis (Spinal Curvature)',
        affectedArea: 'Spine / Musculoskeletal',
        description: 'Lateral spinal curvature and shoulder/pelvic height asymmetry detected.'
      });
    }

    // Kyphosis
    if (kyphosisRisk > 30 || (analysisResult?.status && analysisResult.status.toLowerCase().includes('kyphosis'))) {
      illnessFindings.push({
        id: 'kyphosis-syndrome',
        severity: kyphosisRisk > 60 ? 'severe' : 'moderate',
        label: 'Postural Kyphosis (Hunchback)',
        affectedArea: 'Thoracic Spine / Shoulders',
        description: 'Excessive thoracic curvature and forward rounded shoulder posture detected.'
      });
    }

    // Text Neck
    if (fhpRisk > 35 || (analysisResult?.status && analysisResult.status.toLowerCase().includes('text neck'))) {
      illnessFindings.push({
        id: 'text-neck-syndrome',
        severity: fhpRisk > 65 ? 'severe' : 'moderate',
        label: 'Text Neck Syndrome',
        affectedArea: 'Cervical Spine / Neck',
        description: 'Significant downward head tilt and cervical spine misalignment detected.'
      });
    }

    // Cerebral Palsy
    if (cpRisk > 45 || (analysisResult?.status && analysisResult.status.toLowerCase().includes('cerebral palsy'))) {
      illnessFindings.push({
        id: 'cerebral-palsy',
        severity: cpRisk > 65 ? 'severe' : 'moderate',
        label: 'Cerebral Palsy / Spasticity Indicators',
        affectedArea: 'Multilateral Joint Coordination',
        description: 'Irregular asymmetric joint movement patterns detected across multiple limbs.'
      });
    }

    // Add illness findings to the top of findings array!
    if (illnessFindings.length > 0) {
      const cleanFindings = findings.filter(f => f.id !== 'normal-posture');
      findings.length = 0;
      findings.push(...illnessFindings, ...cleanFindings);
    }

    // ── 5. Build measurements ────────────────────────────────
    const measurements: JointAngleMeasurement[] = [];

    const addMeasurement = (
      joint: string, description: string, value: number | null,
      normalMin: number, normalMax: number, unit = '°',
      mildT: number, modT: number, sevT: number
    ): void => {
      if (value === null || value === 0) return;
      const deviation = Math.max(0, value < normalMin ? normalMin - value : value > normalMax ? value - normalMax : 0);
      measurements.push({
        joint,
        description,
        measured: Math.round(value * 10) / 10,
        normalMin,
        normalMax,
        unit,
        status: getSeverityLabel(deviation, mildT, modT, sevT),
      });
    };

    addMeasurement('Shoulder Symmetry', 'L/R height difference', avgShoulderAsymmetry, 0, 1, '%', 0.8, 2.5, 5);
    addMeasurement('Spine Lateral Angle', 'Torso vertical alignment', avgSpineAngle, 0, 2, '°', 1.5, 3.5, 6);
    addMeasurement('Hip Tilt', 'Pelvic lateral balance', avgHipTilt, 0, 1, '%', 0.8, 2.5, 5);
    addMeasurement('Head Offset', 'Head lateral position', avgHeadOffset, 0, 1.5, '%', 1.0, 3.0, 6.0);
    if (avgLeftElbow > 0) addMeasurement('Left Elbow Angle', 'Elbow joint flexion', avgLeftElbow, 150, 180, '°', 10, 20, 35);
    if (avgRightElbow > 0) addMeasurement('Right Elbow Angle', 'Elbow joint flexion', avgRightElbow, 150, 180, '°', 10, 20, 35);
    if (avgLeftKnee > 0) addMeasurement('Left Knee Angle', 'Knee joint extension', avgLeftKnee, 160, 180, '°', 10, 20, 35);
    if (avgRightKnee > 0) addMeasurement('Right Knee Angle', 'Knee joint extension', avgRightKnee, 160, 180, '°', 10, 20, 35);

    // ── 6. Compute overall score ─────────────────────────────
    const severityPenalty = { normal: 0, mild: 5, moderate: 15, severe: 30 };
    let penalty = 0;
    findings.forEach(f => { if (f.id !== 'normal-posture') penalty += severityPenalty[f.severity]; });
    let score = clamp(100 - penalty, 0, 100);
    if (analysisResult && analysisResult.metrics && analysisResult.metrics.final_score !== undefined) {
      score = analysisResult.metrics.final_score;
    }

    if (frontendTremorScoreOverride !== undefined) {
      score = Math.min(score, frontendTremorScoreOverride);
    }

    const { grade, status } = gradeFromScore(score);

    // ── 7. Summary & recommendation ──────────────────────────
    const abnormalFindings = findings.filter(f => f.id !== 'normal-posture');
    const highRiskConditions = conditions.filter(c => c.risk === 'high');
    const topConditions = conditions.slice(0, 3).map(c => c.name).join(', ');

    const summary = abnormalFindings.length === 0
      ? 'Your posture analysis shows no significant abnormalities. Body alignment, shoulder symmetry, and spinal curvature are all within normal clinical ranges.'
      : `The AI detected ${abnormalFindings.length} area${abnormalFindings.length > 1 ? 's' : ''} of concern: ${abnormalFindings.map(f => f.label).join(', ')}. These findings are based on ${snapshots.length} frames of movement analysis.`;

    // Per-condition clinical recommendations
    const recLines: string[] = ['⚠️ AI screening estimate only — NOT a medical diagnosis. Consult a licensed healthcare professional.'];
    if (tremorProb > 0.35)
      recLines.push('🧠 NEUROLOGIST (Urgent): Resting tremor detected. Evaluation for Parkinson\'s Disease, Essential Tremor, or drug-induced tremor required. Request DaTscan and motor assessment.');
    if (hemiplegiaRisk > 35)
      recLines.push('🧠 NEUROLOGIST: Significant bilateral asymmetry. Brain MRI and functional neurological assessment recommended to rule out stroke / hemiplegia.');
    if (scoliosisRisk > 30)
      recLines.push('🦴 ORTHOPAEDIC SURGEON: Lateral spinal curvature detected. Full-spine X-ray (Cobb angle) recommended. Severe scoliosis may require bracing or surgery.');
    if (kyphosisRisk > 30)
      recLines.push('🦴 PHYSIOTHERAPIST: Forward thoracic rounding detected. Back extensor strengthening and scapular retraction exercises recommended. Ergonomic assessment advised.');
    if (lordosisRisk > 25)
      recLines.push('🦴 PHYSIOTHERAPIST: Excessive lumbar arch. Core stabilization, hip flexor stretching, postural retraining. Lumbar X-ray to rule out spondylolisthesis.');
    if (fhpRisk > 35)
      recLines.push('👨‍⚕️ PHYSIOTHERAPIST / CHIROPRACTOR: Forward head posture (Text Neck). Cervical traction, deep neck flexor exercises, and workstation ergonomic adjustment recommended.');
    if (frozenShoulderRisk > 25 && avgElbowDiff > 15)
      recLines.push('🦴 ORTHOPAEDIC / PHYSIOTHERAPIST: Restricted shoulder ROM detected. Ultrasound imaging of rotator cuff. Physiotherapy mobilization and corticosteroid injection may be indicated.');
    if (knockKneeRisk > 25)
      recLines.push('🦴 ORTHOPAEDIC: Knee alignment anomaly. Full-leg standing X-ray, gait analysis, and orthopaedic review. Orthotics or corrective bracing may be required.');
    if (cpRisk > 40)
      recLines.push('🧠 PAEDIATRIC NEUROLOGIST / REHAB SPECIALIST: Multi-limb spasticity pattern. Neurological evaluation, occupational therapy, and physiotherapy assessment recommended.');
    if (mdRisk > 30 && avgElbowDiff > 10)
      recLines.push('🧬 NEUROMUSCULAR SPECIALIST: Proximal weakness pattern. Creatine kinase (CK) blood test, EMG/nerve conduction study, and possible muscle biopsy referral.');
    if (msRisk > 35 && avgKneeDiff > 8)
      recLines.push('🧠 NEUROLOGIST: Asymmetric motor signs detected. Brain and spinal MRI with contrast, evoked potential studies, and CSF analysis to evaluate for Multiple Sclerosis.');
    if (raRisk > 30 && avgElbowDiff > 15)
      recLines.push('🩺 RHEUMATOLOGIST: Inflammatory arthritis pattern. Anti-CCP, CRP, ESR, and rheumatoid factor blood tests recommended. Early treatment prevents joint destruction.');
    if (torticollisRisk > 30 && avgHeadOffset > 3)
      recLines.push('🦴 PHYSIOTHERAPIST / SPINE SPECIALIST: Cervical misalignment. Cervical X-ray and MRI to rule out disc herniation. Manual therapy and neck stabilization exercises recommended.');
    if (stenosisRisk > 35)
      recLines.push('🦴 SPINE SURGEON: Forward lean and hip compensation. Lumbar MRI, neurodynamic assessment, and pain management consultation recommended.');
    if (impingementRisk > 30 && avgElbowDiff > 12)
      recLines.push('🦴 ORTHOPAEDIC / PHYSIOTHERAPIST: Shoulder elevation asymmetry. Rotator cuff ultrasound or MRI. Subacromial injection and targeted rehabilitation if indicated.');
    if (pelvicRisk > 20)
      recLines.push('🦴 PHYSIOTHERAPIST / PODIATRIST: Pelvic imbalance. Leg length discrepancy assessment, hip flexibility evaluation, and custom orthotics recommended.');
    if (recLines.length === 1 && abnormalFindings.length > 0)
      recLines.push('👨‍⚕️ PHYSIOTHERAPIST: Postural deviations detected. Targeted stretching, core strengthening, and ergonomic workspace adjustment recommended.');

    const recommendation = abnormalFindings.length === 0
      ? '✅ No significant postural abnormalities detected. Continue regular stretching and core strengthening. No immediate clinical consultation required.'
      : recLines.join('\n\n');

    return { score, grade, status, findings, conditions, measurements, summary, recommendation };

  } catch (error: any) {
    return {
      score: 0,
      grade: 'ERR',
      status: 'Error',
      findings: [{ id: 'error', severity: 'severe', label: 'Processing Error', description: error.message, affectedArea: 'System' }],
      conditions: [],
      measurements: [],
      summary: `A frontend crash occurred: ${error.message} - ${error.stack}`,
      recommendation: 'Please share this exact error message with the developers.',
    };
  }
}
