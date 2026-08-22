import { JointPoint } from '../types';

// MediaPipe Pose connection pairs (indices 0 to 32)
export const POSE_CONNECTIONS = [
  [11, 12], // Shoulders
  [11, 13], [13, 15], // Left Arm
  [12, 14], [14, 16], // Right Arm
  [11, 23], [12, 24], [23, 24], // Torso & Hips
  [23, 25], [25, 27], // Left Leg
  [24, 26], [26, 28], // Right Leg
  [27, 29], [29, 31], [27, 31], // Left Foot
  [28, 30], [30, 32], [28, 32]  // Right Foot
];

/**
 * Calculates coordinate variance across recent frames to determine movement stability.
 */
export const getJointsVariance = (indices: number[], history: JointPoint[][]): number => {
  if (history.length < 3) return 0;

  let totalVar = 0;
  indices.forEach(idx => {
    const xVals = history.map(frame => frame[idx]?.x || 0);
    const yVals = history.map(frame => frame[idx]?.y || 0);

    const xMean = xVals.reduce((a, b) => a + b, 0) / xVals.length;
    const yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length;

    const xVar = xVals.reduce((a, b) => a + Math.pow(b - xMean, 2), 0) / xVals.length;
    const yVar = yVals.reduce((a, b) => a + Math.pow(b - yMean, 2), 0) / yVals.length;

    totalVar += (xVar + yVar);
  });

  return totalVar / indices.length;
};

/**
 * Calculates the angle between three joints (e.g. shoulder, elbow, wrist).
 * Returns the angle in degrees [0, 180].
 */
export const calculateJointAngle = (p1: JointPoint, p2: JointPoint, p3: JointPoint): number => {
  if (!p1 || !p2 || !p3) return 0;

  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
};

/**
 * Returns connections filtered by calibration mode.
 */
export const getFilteredConnections = (mode: 'full' | 'half'): number[][] => {
  if (mode === 'full') return POSE_CONNECTIONS;
  // Filter out leg and foot joints (indices 25-32 for half body)
  return POSE_CONNECTIONS.filter(conn => !conn.some(idx => idx >= 25));
};

/**
 * Draws the MediaPipe skeleton and joint dots on the canvas with biofeedback colors.
 */
export const drawSkeleton = (
  ctx: CanvasRenderingContext2D,
  landmarks: JointPoint[],
  landmarkHistory: JointPoint[][],
  canvasWidth: number,
  canvasHeight: number,
  calibrationMode: 'full' | 'half' = 'full'
) => {
  const activeConnections = getFilteredConnections(calibrationMode);

  // Draw connection lines
  activeConnections.forEach(([i1, i2]) => {
    const p1 = landmarks[i1];
    const p2 = landmarks[i2];
    if (!p1 || !p2) return;
    // We remove strict visibility checks to ensure skeleton lines always draw if coordinates exist


    // Compute stability (variance) of these two joints
    const variance = getJointsVariance([i1, i2], landmarkHistory);

    // Dynamic Biofeedback Color Code
    let strokeColor = '#10b981'; // Green (Stable)
    if (variance > 0.012) {
      strokeColor = '#ef4444'; // Red (Unstable / High Tremor)
    } else if (variance > 0.004) {
      strokeColor = '#f59e0b'; // Yellow (Moderate Shake)
    }

    ctx.beginPath();
    ctx.moveTo(p1.x * canvasWidth, p1.y * canvasHeight);
    ctx.lineTo(p2.x * canvasWidth, p2.y * canvasHeight);
    ctx.lineWidth = 4;
    ctx.strokeStyle = strokeColor;
    ctx.shadowBlur = 4;
    ctx.shadowColor = strokeColor;
    ctx.stroke();
  });

  // Draw joint points
  ctx.shadowBlur = 0;
  landmarks.forEach((lm, index) => {
    if (calibrationMode === 'half' && index >= 25) return;
    if (!lm) return;

    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6'; // Blue joints
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // In half-body mode, the user is often sitting, so hips (23, 24) are hidden.
  // We create a virtual point straight down from the shoulder to represent the torso line.
  const getVirtualHip = (shoulder: JointPoint) => {
    if (!shoulder) return undefined;
    return { x: shoulder.x, y: shoulder.y + 0.2, z: shoulder.z, visibility: shoulder.visibility, name: 'virtual_hip' } as JointPoint;
  };

  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  
  // Temporarily insert virtual hips if in half-body mode to calculate shoulder angle
  const p23 = (calibrationMode === 'half') ? getVirtualHip(lShoulder) : landmarks[23];
  const p24 = (calibrationMode === 'half') ? getVirtualHip(rShoulder) : landmarks[24];

  // Modified drawAngle that accepts JointPoint directly instead of indices
  const drawAnglePoints = (p1: JointPoint | undefined, p2: JointPoint | undefined, p3: JointPoint | undefined) => {
    if (p1 && p2 && p3) {
      const angle = calculateJointAngle(p1, p2, p3);
      const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      let diff = angle2 - angle1;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      const anticlockwise = diff < 0;
      const radius = 35;
      const cx = p2.x * canvasWidth;
      const cy = p2.y * canvasHeight;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle1, angle2, anticlockwise);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle1, angle2, anticlockwise);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#10b981';
      ctx.stroke();

      const text = `${Math.round(angle)}°`;
      const tx = cx + 20;
      const ty = cy - 20;

      ctx.font = 'bold 18px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(text, tx, ty);
      ctx.fillStyle = '#34d399'; 
      ctx.fillText(text, tx, ty);
    }
  };

  drawAnglePoints(landmarks[11], landmarks[13], landmarks[15]); // Left Elbow
  drawAnglePoints(landmarks[12], landmarks[14], landmarks[16]); // Right Elbow
  drawAnglePoints(p23, landmarks[11], landmarks[13]); // Left Shoulder (Uses virtual hip if half)
  drawAnglePoints(p24, landmarks[12], landmarks[14]); // Right Shoulder (Uses virtual hip if half)

  // Neck Angle (Forward Head Posture for Kyphosis / Text Neck)
  if (landmarks[0] && landmarks[11] && landmarks[12]) {
    const midShoulder = {
      x: (landmarks[11].x + landmarks[12].x) / 2,
      y: (landmarks[11].y + landmarks[12].y) / 2,
      z: 0,
      visibility: 1
    } as JointPoint;
    const virtualSpineBase = {
      x: midShoulder.x,
      y: midShoulder.y + 0.3,
      z: 0,
      visibility: 1
    } as JointPoint;
    drawAnglePoints(landmarks[0], midShoulder, virtualSpineBase);
  }

  if (calibrationMode === 'full') {
    drawAnglePoints(landmarks[23], landmarks[25], landmarks[27]); // Left Knee
    drawAnglePoints(landmarks[24], landmarks[26], landmarks[28]); // Right Knee
    drawAnglePoints(landmarks[11], landmarks[23], landmarks[25]); // Left Hip
    drawAnglePoints(landmarks[12], landmarks[24], landmarks[26]); // Right Hip
  }
};

/**
 * Draws angle arcs for each finger joint on a detected hand.
 */
export const drawHandAngles = (
  ctx: CanvasRenderingContext2D,
  handLandmarks: JointPoint[],
  canvasWidth: number,
  canvasHeight: number,
  color: string = '#f59e0b'
) => {
  if (!handLandmarks || handLandmarks.length === 0) return;

  const drawAngleArc = (
    p1: JointPoint,
    p2: JointPoint,
    p3: JointPoint
  ) => {
    if (!p1 || !p2 || !p3) return;
    const angle = calculateJointAngle(p1, p2, p3);
    const text = `${Math.round(angle)}°`;
    const tx = p2.x * canvasWidth + 8;
    const ty = p2.y * canvasHeight - 8;

    ctx.font = 'bold 14px sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(text, tx, ty);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, ty);
  };

  // Middle Finger Angle (Middle MCP 9 -> Middle PIP 10 -> Middle Tip 12)
  const middleMcp = handLandmarks[9];
  const middlePip = handLandmarks[10];
  const middleTip = handLandmarks[12];
  if (middleMcp && middlePip && middleTip) {
    drawAngleArc(middleMcp, middlePip, middleTip);
  }

  // Ring Finger Angle (Ring MCP 13 -> Ring PIP 14 -> Ring Tip 16)
  const ringMcp = handLandmarks[13];
  const ringPip = handLandmarks[14];
  const ringTip = handLandmarks[16];
  if (ringMcp && ringPip && ringTip) {
    drawAngleArc(ringMcp, ringPip, ringTip);
  }

  // Pinky Finger Angle (Pinky MCP 17 -> Pinky PIP 18 -> Pinky Tip 20)
  const pinkyMcp = handLandmarks[17];
  const pinkyPip = handLandmarks[18];
  const pinkyTip = handLandmarks[20];
  if (pinkyMcp && pinkyPip && pinkyTip) {
    drawAngleArc(pinkyMcp, pinkyPip, pinkyTip);
  }
};

/**
 * Draws face mesh landmarks (eye/brow/face contour dots) on detected face.
 */
export const drawFaceMesh = (
  ctx: CanvasRenderingContext2D,
  faceLandmarks: JointPoint[],
  canvasWidth: number,
  canvasHeight: number
) => {
  if (!faceLandmarks || faceLandmarks.length === 0) return;

  ctx.fillStyle = '#10b981'; // Green face keypoints matching screenshot
  faceLandmarks.forEach((lm) => {
    if (!lm) return;
    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 2, 0, 2 * Math.PI);
    ctx.fill();
  });
};

/**
 * Draws live joint angle labels on all major joints during SCREENING.
 * Labels are colour-coded: green = normal, yellow = mild deviation, red = significant deviation.
 */
export const drawPoseAngles = (
  ctx: CanvasRenderingContext2D,
  landmarks: JointPoint[],
  canvasWidth: number,
  canvasHeight: number,
  calibrationMode: 'full' | 'half' = 'full'
) => {
  if (!landmarks || landmarks.length === 0) return;

  // Helper: draw a labelled angle badge at a given position
  const drawAngleBadge = (
    x: number, y: number,
    angle: number,
    normalMin: number, normalMax: number,
    label: string
  ) => {
    // Determine badge color
    const deviation = angle < normalMin ? normalMin - angle : angle > normalMax ? angle - normalMax : 0;
    let badgeColor = '#10b981'; // green
    if (deviation > 20) badgeColor = '#ef4444';      // red
    else if (deviation > 8) badgeColor = '#f59e0b';  // yellow

    const text = `${Math.round(angle)}°`;
    const badgeW = 44;
    const badgeH = 18;

    ctx.save();
    // Badge background
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.roundRect(x - badgeW / 2, y - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();

    // Coloured left accent bar
    ctx.fillStyle = badgeColor;
    ctx.fillRect(x - badgeW / 2, y - badgeH / 2, 3, badgeH);

    // Angle text
    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 3, y);

    // Tiny label underneath
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '7px sans-serif';
    ctx.fillText(label, x + 3, y + badgeH / 2 + 5);

    ctx.restore();
  };

  const lm = landmarks;

  // Helper to get a landmark if visible enough
  const get = (idx: number): JointPoint | null => {
    const p = lm[idx];
    if (!p) return null; // only skip truly null/undefined
    return p;
  };

  const px = (p: JointPoint) => p.x * canvasWidth;
  const py = (p: JointPoint) => p.y * canvasHeight;

  // Left elbow
  const lShoulder = get(11), lElbow = get(13), lWrist = get(15);
  if (lShoulder && lElbow && lWrist) {
    const angle = calculateJointAngle(lShoulder, lElbow, lWrist);
    drawAngleBadge(px(lElbow) - 28, py(lElbow), angle, 150, 180, 'L.Elbow');
  }

  // Right elbow
  const rShoulder = get(12), rElbow = get(14), rWrist = get(16);
  if (rShoulder && rElbow && rWrist) {
    const angle = calculateJointAngle(rShoulder, rElbow, rWrist);
    drawAngleBadge(px(rElbow) + 28, py(rElbow), angle, 150, 180, 'R.Elbow');
  }

  // Left shoulder
  const lHip = get(23);
  if (lHip && lShoulder && lElbow) {
    const angle = calculateJointAngle(lHip, lShoulder, lElbow);
    drawAngleBadge(px(lShoulder) - 30, py(lShoulder) - 10, angle, 0, 60, 'L.Shoulder');
  }

  // Right shoulder
  const rHip = get(24);
  if (rHip && rShoulder && rElbow) {
    const angle = calculateJointAngle(rHip, rShoulder, rElbow);
    drawAngleBadge(px(rShoulder) + 30, py(rShoulder) - 10, angle, 0, 60, 'R.Shoulder');
  }

  if (calibrationMode === 'full') {
    // Left knee
    const lKnee = get(25), lAnkle = get(27);
    if (lHip && lKnee && lAnkle) {
      const angle = calculateJointAngle(lHip, lKnee, lAnkle);
      drawAngleBadge(px(lKnee) - 28, py(lKnee), angle, 160, 180, 'L.Knee');
    }

    // Right knee
    const rKnee = get(26), rAnkle = get(28);
    if (rHip && rKnee && rAnkle) {
      const angle = calculateJointAngle(rHip, rKnee, rAnkle);
      drawAngleBadge(px(rKnee) + 28, py(rKnee), angle, 160, 180, 'R.Knee');
    }

    // Left hip
    const lKneeForHip = get(25);
    if (lShoulder && lHip && lKneeForHip) {
      const angle = calculateJointAngle(lShoulder, lHip, lKneeForHip);
      drawAngleBadge(px(lHip) - 30, py(lHip) + 8, angle, 160, 180, 'L.Hip');
    }

    // Right hip
    const rKneeForHip = get(26);
    if (rShoulder && rHip && rKneeForHip) {
      const angle = calculateJointAngle(rShoulder, rHip, rKneeForHip);
      drawAngleBadge(px(rHip) + 30, py(rHip) + 8, angle, 160, 180, 'R.Hip');
    }
  }
};

