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

  // ── Cerebral Palsy Indicators ────────────────────────────
  const cpRisk = clamp(
    Math.round((avgElbowDiff * 2) + (avgKneeDiff * 1.5) + (avgShoulderAsymmetry * 3)),
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

  // ── Essential Tremor (elbow angle variance proxy) ─────────
  // Since we don't have raw temporal data at this level, we check elbow angle spread
  if (avgElbowDiff > 20 && avgShoulderAsymmetry < 3) {
    conditions.push({
      name: 'Essential Tremor (Possible)',
      risk: 'low',
      probability: clamp(Math.round(avgElbowDiff * 2), 0, 60),
      description: 'Minor asymmetric arm positioning detected. Essential tremor is an action tremor — a neurologist assessment with specific hand/arm movement tests is needed to confirm.',
    });
  }

  // ── Parkinson's Disease (tremor model feeds this via backend) ─
  // This is primarily detected by the backend Swin Transformer.
  // If analysisResult indicates high tremor score, it appears in the conditions.
  // (Handled separately by the backend AI — see analysisResult.tremor_score)

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
  const score = clamp(100 - penalty, 0, 100);
  const { grade, status } = gradeFromScore(score);

  // ── 7. Summary & recommendation ──────────────────────────
  const abnormalFindings = findings.filter(f => f.id !== 'normal-posture');
  const highRiskConditions = conditions.filter(c => c.risk === 'high');
  const topConditions = conditions.slice(0, 3).map(c => c.name).join(', ');

  const summary = abnormalFindings.length === 0
    ? 'Your posture analysis shows no significant abnormalities. Body alignment, shoulder symmetry, and spinal curvature are all within normal clinical ranges.'
    : `The AI detected ${abnormalFindings.length} area${abnormalFindings.length > 1 ? 's' : ''} of concern: ${abnormalFindings.map(f => f.label).join(', ')}. These findings are based on ${snapshots.length} frames of movement analysis.`;

  const recommendation = abnormalFindings.length === 0
    ? 'Continue your current posture habits. Regular stretching and core strengthening exercises are recommended. No immediate clinical consultation required based on this screening.'
    : `⚠️ This is an AI estimate only — not a medical diagnosis. ${highRiskConditions.length > 0
      ? `High-risk indicators suggest possible: ${highRiskConditions.map(c => c.name).join(', ')}. Please consult an orthopaedic specialist or neurologist immediately.`
      : conditions.length > 0
        ? `Possible conditions detected: ${topConditions}. Consider scheduling a physiotherapy or clinical assessment.`
        : 'Postural deviations detected. Targeted stretching and posture correction exercises are recommended.'
    }`;

  return { score, grade, status, findings, conditions, measurements, summary, recommendation };
}
