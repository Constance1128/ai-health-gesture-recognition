import React, { useEffect, useRef, useState } from 'react';
import { Card, Space, Switch, Spin, Tag, message } from 'antd';
import { VideoCameraOutlined, SyncOutlined } from '@ant-design/icons';
import { User, JointPoint, AnalysisResult, ScreenState, SkeletalFeedProps } from '../types';
import { drawSkeleton, getJointsVariance, getFilteredConnections, drawPoseAngles } from '../utils/kinesiology';
import { PostureSnapshot, buildSnapshot } from '../utils/postureDiagnosis';
import * as analysisApi from '../api/analysis.api';

export const SkeletalFeed: React.FC<SkeletalFeedProps & { onSnapshotsCollected?: (snapshots: PostureSnapshot[]) => void }> = ({
  cameraActive,
  setCameraActive,
  screenState,
  activeMode,
  currentUser,
  backendConnected,
  analysisResult,
  setAnalysisResult,
  fetchHistory,
  uploading,
  prepSeconds,
  countdownSeconds,
  screeningSeconds,
  isDarkMode,
  calibrationMode = 'full',
  onCalibrationStatusChange,
  onSnapshotsCollected,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkHistoryRef = useRef<JointPoint[][]>([]);
  const isStaticRef = useRef<boolean>(false);
  const analysisResultRef = useRef<AnalysisResult | null>(null);
  const humanRef = useRef<any>(null);
  const angleSnapshotsRef = useRef<PostureSnapshot[]>([]);
  const screenStateRef = useRef<ScreenState>(screenState);
  const [humanLoading, setHumanLoading] = useState(true);

  // Keep screenStateRef in sync so render loop can use it without stale closure
  useEffect(() => {
    screenStateRef.current = screenState;
    // When SCREENING begins, reset snapshot accumulator
    if (screenState === 'SCREENING') {
      angleSnapshotsRef.current = [];
    }
    // When FINISHED, pass collected snapshots up
    if (screenState === 'FINISHED' && onSnapshotsCollected) {
      onSnapshotsCollected(angleSnapshotsRef.current);
    }
  }, [screenState]);

  useEffect(() => {
    analysisResultRef.current = analysisResult;
  }, [analysisResult]);

  useEffect(() => {
    let isMounted = true;
    const initHuman = async () => {
      try {
        const { Human } = await import('@vladmandic/human');
        const h = new Human({
          backend: 'webgl',
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@latest/models',
          face: { enabled: false },
          body: { enabled: true },
          hand: { enabled: false },
          object: { enabled: false },
          segmentation: { enabled: false },
          filter: { enabled: false }
        });
        await h.load();
        await h.warmup();
        if (isMounted) {
          humanRef.current = h;
          setHumanLoading(false);
        }
      } catch (err) {
        console.error("Failed to load local pose tracker:", err);
      }
    };
    initHuman();
    return () => {
      isMounted = false;
    };
  }, []);

  // MoveNet to MediaPipe index mapping defined outside components
  const moveNetMap: { [key: number]: number } = {
    0: 0,   // nose -> nose
    5: 11,  // leftShoulder -> left_shoulder
    6: 12,  // rightShoulder -> right_shoulder
    7: 13,  // leftElbow -> left_elbow
    8: 14,  // rightElbow -> right_elbow
    9: 15,  // leftWrist -> left_wrist
    10: 16, // rightWrist -> right_wrist
    11: 23, // leftHip -> left_hip
    12: 24, // rightHip -> right_hip
    13: 25, // leftKnee -> left_knee
    14: 26, // rightKnee -> right_knee
    15: 27, // leftAnkle -> left_ankle
    16: 28  // rightAnkle -> right_ankle
  };

  const prepSecondsRef = useRef<number>(prepSeconds);
  const countdownSecondsRef = useRef<number>(countdownSeconds);
  const screeningSecondsRef = useRef<number>(screeningSeconds);

  useEffect(() => {
    prepSecondsRef.current = prepSeconds;
  }, [prepSeconds]);

  useEffect(() => {
    countdownSecondsRef.current = countdownSeconds;
  }, [countdownSeconds]);

  useEffect(() => {
    screeningSecondsRef.current = screeningSeconds;
  }, [screeningSeconds]);

  // Initial status triggers when entering PREPARATION
  useEffect(() => {
    if (screenState === 'PREPARATION' && onCalibrationStatusChange) {
      onCalibrationStatusChange(false, humanLoading ? 'loading' : 'not_detected');
    }
  }, [screenState, humanLoading]);

  // 1. Manage Webcam Stream
  useEffect(() => {
    if (cameraActive) {
      navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(err => console.error('Webcam play error:', err));
          }
          streamRef.current = stream;
        })
        .catch((err) => {
          console.error('Error accessing webcam:', err);
          message.error('Failed to access webcam. Check permissions or if another app is using it.');
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive]);

  const localLandmarksRef = useRef<JointPoint[]>([]);
  const isLocalFallbackRef = useRef<boolean>(true);

  // 2. Client-Side AI Detection Loop (Asynchronous, non-blocking)
  useEffect(() => {
    let isCancelled = false;

    const detectionLoop = async () => {
      if (isCancelled) return;

      const video = videoRef.current;
      if (humanRef.current && cameraActive && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const result = await humanRef.current.detect(video);
          if (result.body && result.body.length > 0) {
            isLocalFallbackRef.current = false;
            const body = result.body[0];

            const mapped = Array(33).fill(null).map((_, i) => ({
              name: `joint_${i}`,
              x: 0.5,
              y: 0.5,
              z: 0,
              visibility: 0
            }));

            body.keypoints.forEach((kp: any) => {
              const mpIdx = moveNetMap[kp.id];
              if (mpIdx !== undefined) {
                mapped[mpIdx] = {
                  name: kp.part,
                  x: kp.positionRaw[0],
                  y: kp.positionRaw[1],
                  z: kp.positionRaw[2] || 0,
                  visibility: kp.score
                };
              }
            });
            localLandmarksRef.current = mapped;

            // Update landmark history and calibration status locally (Real-time 30 FPS calibration!)
            if (screenState === 'PREPARATION' || screenState === 'SCREENING') {
              landmarkHistoryRef.current.push(mapped);
              landmarkHistoryRef.current = landmarkHistoryRef.current.slice(-5);

              // Accumulate posture snapshots during SCREENING (one every ~10 frames)
              if (screenStateRef.current === 'SCREENING') {
                if (angleSnapshotsRef.current.length === 0 ||
                    Date.now() - angleSnapshotsRef.current[angleSnapshotsRef.current.length - 1].timestamp > 300) {
                  angleSnapshotsRef.current.push(buildSnapshot(mapped));
                }
              }

              if (screenState === 'PREPARATION' && onCalibrationStatusChange && landmarkHistoryRef.current.length >= 3) {
                const activeConnections = getFilteredConnections(calibrationMode);
                const activeIndices = Array.from(new Set(activeConnections.flat())) as number[];
                const variance = getJointsVariance(activeIndices, landmarkHistoryRef.current);

                // Strict, precise validation matching the visual guide lines
                let isInsideBox = true;
                let detail: 'ok' | 'not_detected' | 'too_far' | 'too_close' | 'moving' | 'outside' = 'ok';
                const nose = mapped[0];
                const lShoulder = mapped[11];
                const rShoulder = mapped[12];
                const lHip = mapped[23];
                const rHip = mapped[24];

                if (
                  !nose || nose.visibility === undefined || nose.visibility < 0.2 ||
                  !lShoulder || lShoulder.visibility === undefined || lShoulder.visibility < 0.2 ||
                  !rShoulder || rShoulder.visibility === undefined || rShoulder.visibility < 0.2
                ) {
                  isInsideBox = false;
                  detail = 'not_detected';
                } else {
                  const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);

                  // Check if too far or too close
                  if (shoulderWidth < 0.12) {
                    isInsideBox = false;
                    detail = 'too_far';
                  } else if (shoulderWidth > 0.35) {
                    isInsideBox = false;
                    detail = 'too_close';
                  } else if (
                    lShoulder.x < 0.25 || lShoulder.x > 0.75 ||
                    rShoulder.x < 0.25 || rShoulder.x > 0.75 ||
                    nose.x < 0.25 || nose.x > 0.75
                  ) {
                    isInsideBox = false;
                    detail = 'outside';
                  }

                  // Vertical checks based on visual guide lines
                  if (isInsideBox) {
                    if (calibrationMode === 'half') {
                      if (nose.y < 0.15 || nose.y > 0.45) {
                        isInsideBox = false;
                        detail = 'outside';
                      }
                      if (lShoulder.y < 0.3 || lShoulder.y > 0.6) {
                        isInsideBox = false;
                        detail = 'outside';
                      }
                    } else {
                      if (
                        !lHip || lHip.visibility === undefined || lHip.visibility < 0.2 ||
                        !rHip || rHip.visibility === undefined || rHip.visibility < 0.2
                      ) {
                        isInsideBox = false;
                        detail = 'too_close';
                      } else {
                        if (
                          lHip.x < 0.25 || lHip.x > 0.75 ||
                          rHip.x < 0.25 || rHip.x > 0.75 ||
                          lHip.y < 0.45 || lHip.y > 0.75
                        ) {
                          isInsideBox = false;
                          detail = 'outside';
                        }
                        if (nose.y < 0.05 || nose.y > 0.3) {
                          isInsideBox = false;
                          detail = 'outside';
                        }
                      }
                    }
                  }
                }

                // Call validation status instantly
                const isStatic = variance < 0.008;
                const isValidPose = isStatic && isInsideBox;
                if (isInsideBox && !isStatic) {
                  detail = 'moving';
                }
                isStaticRef.current = isValidPose;
                if (onCalibrationStatusChange) {
                  onCalibrationStatusChange(isValidPose, detail);
                }
              }
            }
          } else {
            // No body detected
            isLocalFallbackRef.current = true;
            if (screenState === 'PREPARATION' && onCalibrationStatusChange) {
              isStaticRef.current = false;
              onCalibrationStatusChange(false);
            }
          }
        } catch (err) {
          console.error("Local pose detection error:", err);
          if (screenState === 'PREPARATION' && onCalibrationStatusChange) {
            isStaticRef.current = false;
            onCalibrationStatusChange(false);
          }
        }
      } else {
        // Human not loaded, camera inactive, or no video data
        if (screenState === 'PREPARATION' && onCalibrationStatusChange) {
          isStaticRef.current = false;
          onCalibrationStatusChange(false);
        }
      }

      // Schedule next detection immediately (async loop)
      setTimeout(detectionLoop, 10);
    };

    if (cameraActive && !humanLoading) {
      detectionLoop();
    }

    return () => {
      isCancelled = true;
    };
  }, [cameraActive, humanLoading, screenState, calibrationMode]);

  // 3. Decoupled 60 FPS Render Loop (Never block video rendering!)
  useEffect(() => {
    let animationFrameId: number;
    let lastProcessingTime = 0;
    let isCancelled = false;

    const renderLoop = async (timestamp: number) => {
      if (isCancelled) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw webcam background instantly at 60 FPS
      if (cameraActive && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Camera Feed Inactive', canvas.width / 2, canvas.height / 2);
      }

      // Draw Silhouette Guide during PREPARATION
      if (screenState === 'PREPARATION') {
        drawPreparationGuide(ctx, canvas.width, canvas.height);
      }

      // Draw Countdown Overlay during COUNTDOWN
      if (screenState === 'COUNTDOWN') {
        console.log(`[Canvas HUD] Drawing COUNTDOWN overlay: ${countdownSecondsRef.current}s`);
        drawCountdownOverlay(ctx, canvas.width, canvas.height);
      }

      // Draw Screening Progress Bar during SCREENING
      if (screenState === 'SCREENING') {
        console.log(`[Canvas HUD] Drawing SCREENING overlay: ${screeningSecondsRef.current}s`);
        drawScreeningHUD(ctx, canvas.width, canvas.height);
      }

      // Send frame to backend at throttled interval for Swin/BiLSTM clinical evaluation
      if ((screenState === 'SCREENING' || screenState === 'PREPARATION') && cameraActive && timestamp - lastProcessingTime > 400) {
        lastProcessingTime = timestamp;
        analysisApi.analyzeFrame({
          mode: activeMode,
          session_id: "patient_guided_session",
          user_email: currentUser?.email,
          image_base64: canvas.toDataURL('image/jpeg', 0.6)
        }).then(data => {
          setAnalysisResult(data);
          analysisResultRef.current = data;
          fetchHistory(currentUser?.email);

          // Fallback calibration check using backend landmarks if local tracker fails/loads
          if (screenState === 'PREPARATION' && isLocalFallbackRef.current && onCalibrationStatusChange) {
            if (data.landmarks && data.landmarks.length > 0 && !data.is_fallback) {
              let isInsideBox = true;
              let detail: 'ok' | 'not_detected' | 'too_far' | 'too_close' | 'moving' | 'outside' = 'ok';

              const nose = data.landmarks[0];
              const lShoulder = data.landmarks[11];
              const rShoulder = data.landmarks[12];
              const lHip = data.landmarks[23];
              const rHip = data.landmarks[24];

              if (!nose || !lShoulder || !rShoulder) {
                isInsideBox = false;
                detail = 'not_detected';
              } else {
                const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
                if (shoulderWidth < 0.12) {
                  isInsideBox = false;
                  detail = 'too_far';
                } else if (shoulderWidth > 0.35) {
                  isInsideBox = false;
                  detail = 'too_close';
                } else if (
                  lShoulder.x < 0.25 || lShoulder.x > 0.75 ||
                  rShoulder.x < 0.25 || rShoulder.x > 0.75 ||
                  nose.x < 0.25 || nose.x > 0.75
                ) {
                  isInsideBox = false;
                  detail = 'outside';
                }
              }

              // Since backend is throttled, we push to history to calculate stability
              landmarkHistoryRef.current.push(data.landmarks);
              landmarkHistoryRef.current = landmarkHistoryRef.current.slice(-5);

              let isStatic = true;
              if (landmarkHistoryRef.current.length >= 3) {
                const activeConnections = getFilteredConnections(calibrationMode);
                const activeIndices = Array.from(new Set(activeConnections.flat())) as number[];
                const variance = getJointsVariance(activeIndices, landmarkHistoryRef.current);
                isStatic = variance < 0.008;
              }

              const isValidPose = isStatic && isInsideBox;
              if (isInsideBox && !isStatic) detail = 'moving';

              isStaticRef.current = isValidPose;
              onCalibrationStatusChange(isValidPose, detail);
            } else {
              // If backend failed or fell back, report appropriate status
              onCalibrationStatusChange(false, data.is_fallback ? 'too_close' : 'not_detected');
            }
          }
        }).catch(err => {
          console.error("Backend frame processing error:", err);
        });
      }

      if (isCancelled) return;

      // Draw local 30 FPS skeleton overlay, falling back to backend landmarks if local is unavailable
      const localLandmarks = localLandmarksRef.current;
      const isLocalFallback = isLocalFallbackRef.current;
      const currentAnalysis = analysisResultRef.current;
      const activeLandmarks = (localLandmarks.length > 0 && !isLocalFallback)
        ? localLandmarks
        : (currentAnalysis && currentAnalysis.landmarks && currentAnalysis.landmarks.length > 0 ? currentAnalysis.landmarks : null);

      if (activeLandmarks) {
        drawSkeleton(
          ctx,
          activeLandmarks,
          landmarkHistoryRef.current,
          canvas.width,
          canvas.height,
          calibrationMode
        );
        // Draw live angle labels during SCREENING
        if (screenStateRef.current === 'SCREENING') {
          drawPoseAngles(ctx, activeLandmarks, canvas.width, canvas.height);
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeMode, cameraActive, backendConnected, screenState, currentUser, calibrationMode]);

  // UI HUD Drawings
  const drawPreparationGuide = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Determine silhouette color based on calibration status (QuickPose style feedback)
    let guideColor = '#3b82f6'; // Default Blue
    const isFallback = analysisResultRef.current?.is_fallback;

    if (landmarkHistoryRef.current.length >= 3) {
      if (isFallback) {
        guideColor = '#ef4444'; // Red if too close/fallback
      } else if (!isStaticRef.current) {
        guideColor = '#eab308'; // Yellow if detected but moving
      } else {
        guideColor = '#10b981'; // Green if locked in perfectly
      }
    }

    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);

    // Draw body silhouette guide
    const topY = calibrationMode === 'half' ? h * 0.15 : h * 0.05;
    const botY = calibrationMode === 'half' ? h * 0.95 : h * 0.95;

    ctx.strokeRect(w * 0.25, topY, w * 0.5, botY - topY);
    ctx.beginPath();

    if (calibrationMode === 'half') {
      ctx.arc(w * 0.5, h * 0.28, 40, 0, 2 * Math.PI); // Head
      ctx.moveTo(w * 0.35, h * 0.45); ctx.lineTo(w * 0.65, h * 0.45); // Shoulders
      ctx.moveTo(w * 0.5, h * 0.45); ctx.lineTo(w * 0.5, h * 0.95); // Spine
      ctx.moveTo(w * 0.35, h * 0.45); ctx.lineTo(w * 0.3, h * 0.8); // L Arm
      ctx.moveTo(w * 0.65, h * 0.45); ctx.lineTo(w * 0.7, h * 0.8); // R Arm
    } else {
      ctx.arc(w * 0.5, h * 0.15, 30, 0, 2 * Math.PI); // Head
      ctx.moveTo(w * 0.38, h * 0.25); ctx.lineTo(w * 0.62, h * 0.25); // Shoulders
      ctx.moveTo(w * 0.5, h * 0.25); ctx.lineTo(w * 0.5, h * 0.55); // Spine
      ctx.moveTo(w * 0.4, h * 0.55); ctx.lineTo(w * 0.6, h * 0.55); // Hips
      ctx.moveTo(w * 0.38, h * 0.25); ctx.lineTo(w * 0.32, h * 0.5); // L Arm
      ctx.moveTo(w * 0.62, h * 0.25); ctx.lineTo(w * 0.68, h * 0.5); // R Arm
      ctx.moveTo(w * 0.4, h * 0.55); ctx.lineTo(w * 0.4, h * 0.9); // L Leg
      ctx.moveTo(w * 0.6, h * 0.55); ctx.lineTo(w * 0.6, h * 0.9); // R Leg
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Dim background outside guide box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(0, 0, w, topY);
    ctx.fillRect(0, botY, w, h - botY);
    ctx.fillRect(0, topY, w * 0.25, botY - topY);
    ctx.fillRect(w * 0.75, topY, w * 0.25, botY - topY);

    // Preparation text (Drawn at h * 0.18 to prevent object-cover CSS cropping)
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#000000';

    const textY = h * 0.18;

    if (landmarkHistoryRef.current.length < 3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Align Body In Guide & Stand Still`, w / 2, textY);
    } else if (isFallback) {
      ctx.fillStyle = '#ef4444'; // Red text, normal style
      ctx.fillText(`Step Back: Camera cannot see your full body!`, w / 2, textY);
    } else if (!isStaticRef.current) {
      ctx.fillStyle = '#eab308'; // Yellow
      ctx.fillText(`Body Detected: Please stand perfectly still!`, w / 2, textY);
    } else {
      ctx.fillStyle = '#10b981'; // Green
      ctx.fillText(`Hold Still! Calibrating: ${prepSecondsRef.current}s`, w / 2, textY);
    }
    ctx.shadowBlur = 0;
  };

  const drawCountdownOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const sec = countdownSecondsRef.current;

    // Dark overlay
    ctx.fillStyle = 'rgba(10, 14, 30, 0.82)';
    ctx.fillRect(0, 0, w, h);

    // Outer ring
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.18;
    const ringColor = sec === 3 ? '#10b981' : sec === 2 ? '#f59e0b' : '#ef4444';

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Progress arc (counts down)
    const progress = (4 - sec) / 3; // 0→1 as countdown goes 3→0
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 16;
    ctx.shadowColor = ringColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';

    // Number
    ctx.fillStyle = ringColor;
    ctx.font = `bold ${Math.round(radius * 1.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 20;
    ctx.shadowColor = ringColor;
    ctx.fillText(`${sec}`, cx, cy);
    ctx.shadowBlur = 0;

    // Top label
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(radius * 0.28)}px sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('GET READY', cx, cy - radius - 18);

    // Bottom hint
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${Math.round(radius * 0.22)}px sans-serif`;
    ctx.fillText('Posture detection is about to start', cx, cy + radius + 28);
    ctx.textAlign = 'left';
  };

  const drawScreeningHUD = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const currentSec = screeningSecondsRef.current;
    const totalSec = 15;

    // Top Progress Bar (grows from 0% to 100%)
    const progressPercent = ((totalSec - currentSec) / totalSec);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, w, 10);
    // Gradient progress bar
    const grad = ctx.createLinearGradient(0, 0, w * progressPercent, 0);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w * progressPercent, 10);

    // Timer Tag (top right)
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(w - 90, 18, 80, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentSec}s left`, w - 50, 37);

    // START MESSAGE: first 2 seconds
    if (currentSec > totalSec - 2) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.92)';
      const bw = w * 0.65, bh = h * 0.22;
      const bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(bh * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START DETECTING!', w / 2, h / 2);
      ctx.textBaseline = 'alphabetic';
    }

    // STOP MESSAGE: last 2 seconds
    if (currentSec <= 2 && currentSec > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
      const bw = w * 0.65, bh = h * 0.22;
      const bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(bh * 0.42)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ANALYSIS COMPLETE!', w / 2, h / 2);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.textAlign = 'left';
  };

  return (
    <Card
      title={
        <Space>
          <VideoCameraOutlined className="text-emerald-500" />
          <span>Live Skeletal Screening & Biofeedback</span>
        </Space>
      }
      className={`shadow-lg border-0 overflow-hidden ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'}`}
      extra={
        <Space>
          <span className="text-xs text-slate-400">Webcam Stream</span>
          <Switch
            checked={cameraActive}
            onChange={(checked) => setCameraActive(checked)}
            checkedChildren="On"
            unCheckedChildren="Off"
            disabled={screenState === 'SCREENING' || screenState === 'PREPARATION' || screenState === 'COUNTDOWN'}
          />
        </Space>
      }
    >
      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
        {uploading ? (
          <div className="text-center space-y-3 z-10">
            <Spin size="large" />
            <div className="text-sm text-slate-400 font-semibold">AI is analyzing video frames. Please wait...</div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="hidden"
              width="640"
              height="480"
            />
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              className="w-full h-full object-cover"
            />
          </>
        )}

        <div className="absolute top-3 left-3 flex space-x-2">
          <Tag color="emerald" className="m-0 border-0 flex items-center">
            <SyncOutlined spin className="mr-1" /> {screenState}
          </Tag>
          <Tag color="blue" className="m-0 border-0 uppercase">
            {activeMode}
          </Tag>
        </div>
      </div>
    </Card>
  );
};
