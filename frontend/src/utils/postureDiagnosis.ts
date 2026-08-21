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

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
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
    nose:          landmarks[0],
    leftShoulder:  landmarks[11],
    rightShoulder: landmarks[12],
    leftElbow:     landmarks[13],
    rightElbow:    landmarks[14],
    leftWrist:     landmarks[15],
    rightWrist:    landmarks[16],
    leftHip:       landmarks[23],
    rightHip:      landmarks[24],
    leftKnee:      landmarks[25],
    rightKnee:     landmarks[26],
    leftAnkle:     landmarks[27],
    rightAnkle:    landmarks[28],
  };
}

// ────────────────────────────────────────────
// Main diagnosis engine
// ────────────────────────────────────────────

export function generateDiagnosis(snapshots: PostureSnapshot[]): DiagnosisReport {
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
  const avgShoulderAsymmetry = avg(shoulderAsymmetries);
  const avgHipTilt = avg(hipTilts);
  const avgHeadOffset = avg(headForwardOffsets);
  const avgSpineAngle = avg(spineAngles);
  const avgLeftElbow = avg(leftElbowAngles);
  const avgRightElbow = avg(rightElbowAngles);
  const avgLeftKnee = avg(leftKneeAngles);
  const avgRightKnee = avg(rightKneeAngles);

  // ── 3. Build findings ────────────────────
  const findings: PostureFinding[] = [];

  // Shoulder asymmetry (threshold: mild >2%, moderate >5%, severe >8%)
  const shoulderSev = getSeverityLabel(avgShoulderAsymmetry, 2, 5, 8);
  if (shoulderSev !== 'normal') {
    findings.push({
      id: 'shoulder-asymmetry',
      severity: shoulderSev,
      label: 'Shoulder Level Difference',
      affectedArea: 'Shoulders',
      description: `Your left and right shoulders are at different heights (${avgShoulderAsymmetry.toFixed(1)}% difference). This may indicate ${shoulderSev === 'severe' ? 'significant scoliosis or muscle imbalance' : shoulderSev === 'moderate' ? 'mild scoliosis or chronic posture habits' : 'minor posture imbalance or muscle tightness'}.`,
    });
  }

  // Hip tilt (threshold: mild >2%, moderate >4%, severe >7%)
  const hipSev = getSeverityLabel(avgHipTilt, 2, 4, 7);
  if (hipSev !== 'normal') {
    findings.push({
      id: 'hip-tilt',
      severity: hipSev,
      label: 'Pelvic Tilt Detected',
      affectedArea: 'Hips / Pelvis',
      description: `Uneven hip height detected (${avgHipTilt.toFixed(1)}% tilt). ${hipSev === 'severe' ? 'Significant pelvic tilt may lead to lower back pain and gait asymmetry.' : hipSev === 'moderate' ? 'Moderate pelvic tilt often relates to leg length discrepancy or hip flexor tightness.' : 'Slight pelvic tilt may be due to standing posture habits.'}`,
    });
  }

  // Forward head / spine lean (threshold: mild >3°, moderate >6°, severe >10°)
  const spineSev = getSeverityLabel(avgSpineAngle, 3, 6, 10);
  if (spineSev !== 'normal') {
    findings.push({
      id: 'spine-misalignment',
      severity: spineSev,
      label: 'Spine Lateral Misalignment',
      affectedArea: 'Spine / Torso',
      description: `The spine shows a lateral lean of approximately ${avgSpineAngle.toFixed(1)}°. ${spineSev === 'severe' ? 'This level of misalignment may indicate scoliosis or significant postural dysfunction.' : spineSev === 'moderate' ? 'Moderate curvature may relate to prolonged poor sitting habits or muscle imbalance.' : 'Minor spine lean is common and often correctable with targeted exercises.'}`,
    });
  }

  // Head offset (threshold: mild >3%, moderate >6%, severe >10%)
  const headSev = getSeverityLabel(avgHeadOffset, 3, 6, 10);
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

  // ── 4. Build conditions ──────────────────
  const conditions: PossibleCondition[] = [];

  // Scoliosis risk
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

  // Forward Head Posture
  const fhpRisk = clamp(Math.round(avgHeadOffset * 8), 0, 100);
  if (fhpRisk > 20) {
    conditions.push({
      name: 'Forward Head Posture',
      risk: fhpRisk > 65 ? 'high' : fhpRisk > 40 ? 'moderate' : 'low',
      probability: fhpRisk,
      description: 'Head positioned forward of the body center, increasing strain on the cervical spine and neck muscles.',
    });
  }

  // Pelvic imbalance
  const pelvicRisk = clamp(Math.round(avgHipTilt * 12), 0, 100);
  if (pelvicRisk > 20) {
    conditions.push({
      name: 'Pelvic Imbalance',
      risk: pelvicRisk > 60 ? 'high' : pelvicRisk > 35 ? 'moderate' : 'low',
      probability: pelvicRisk,
      description: 'Unequal hip height may indicate leg length discrepancy, hip flexor tightness, or structural imbalance.',
    });
  }

  // Kyphosis (slouching) — rough proxy: high spine angle + shoulder drop
  const kyphosisRisk = clamp(Math.round((avgSpineAngle * 5) + (avgShoulderAsymmetry * 3)), 0, 100);
  if (kyphosisRisk > 20) {
    conditions.push({
      name: 'Postural Kyphosis (Rounded Shoulders)',
      risk: kyphosisRisk > 65 ? 'high' : kyphosisRisk > 40 ? 'moderate' : 'low',
      probability: kyphosisRisk,
      description: 'Excessive forward rounding of the upper back and shoulders, commonly caused by prolonged sitting or weak upper back muscles.',
    });
  }

  // ── 5. Build measurements ────────────────
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

  addMeasurement('Shoulder Symmetry', 'L/R height difference', avgShoulderAsymmetry, 0, 2, '%', 1, 3, 5);
  addMeasurement('Spine Lateral Angle', 'Torso vertical alignment', avgSpineAngle, 0, 3, '°', 2, 5, 8);
  addMeasurement('Hip Tilt', 'Pelvic lateral balance', avgHipTilt, 0, 2, '%', 1, 3, 6);
  addMeasurement('Head Offset', 'Head lateral position', avgHeadOffset, 0, 3, '%', 2, 5, 8);
  if (avgLeftElbow > 0) addMeasurement('Left Elbow Angle', 'Elbow joint flexion', avgLeftElbow, 150, 180, '°', 10, 20, 35);
  if (avgRightElbow > 0) addMeasurement('Right Elbow Angle', 'Elbow joint flexion', avgRightElbow, 150, 180, '°', 10, 20, 35);
  if (avgLeftKnee > 0) addMeasurement('Left Knee Angle', 'Knee joint extension', avgLeftKnee, 160, 180, '°', 10, 20, 35);
  if (avgRightKnee > 0) addMeasurement('Right Knee Angle', 'Knee joint extension', avgRightKnee, 160, 180, '°', 10, 20, 35);

  // ── 6. Compute overall score ─────────────
  const severityPenalty = {
    normal: 0,
    mild: 5,
    moderate: 15,
    severe: 30,
  };

  let penalty = 0;
  findings.forEach(f => {
    if (f.id !== 'normal-posture') {
      penalty += severityPenalty[f.severity];
    }
  });

  const score = clamp(100 - penalty, 0, 100);
  const { grade, status } = gradeFromScore(score);

  // ── 7. Summary & recommendation ─────────
  const abnormalFindings = findings.filter(f => f.id !== 'normal-posture');

  const summary = abnormalFindings.length === 0
    ? 'Your posture analysis shows no significant abnormalities. Body alignment, shoulder symmetry, and spinal curvature are all within normal clinical ranges.'
    : `The AI detected ${abnormalFindings.length} area${abnormalFindings.length > 1 ? 's' : ''} of concern: ${abnormalFindings.map(f => f.label).join(', ')}. These findings are based on ${snapshots.length} frames of movement analysis.`;

  const recommendation = abnormalFindings.length === 0
    ? 'Continue your current posture habits. Regular stretching and core strengthening exercises are recommended to maintain spinal health. No immediate clinical consultation required based on this screening.'
    : `⚠️ This is an AI estimate only — not a medical diagnosis. Based on the detected patterns, consider: ${
        conditions.some(c => c.risk === 'high')
          ? 'Consulting an orthopaedic specialist or physiotherapist for a full evaluation. High-risk indicators were detected that warrant professional assessment.'
          : conditions.some(c => c.risk === 'moderate')
          ? 'Scheduling a posture assessment with a physiotherapist. Moderate risk indicators were detected.'
          : 'Performing targeted stretching and posture correction exercises. Low-risk indicators were detected.'
      } Please visit a hospital or clinic for a thorough musculoskeletal evaluation.`;

  return { score, grade, status, findings, conditions, measurements, summary, recommendation };
}
