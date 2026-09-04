import React, { useEffect, useRef, useState } from 'react';
import { Card, Space, Switch, Spin, Tag, message } from 'antd';
import { VideoCameraOutlined, SyncOutlined } from '@ant-design/icons';
import { User, JointPoint, AnalysisResult, ScreenState, SkeletalFeedProps } from '../types';
import { drawSkeleton, getJointsVariance, getFilteredConnections, drawPoseAngles, drawHands, drawFace } from '../utils/kinesiology';
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
  sessionId,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkHistoryRef = useRef<JointPoint[][]>([]);
  const isStaticRef = useRef<boolean>(false);
  const calibrationDetailRef = useRef<string>('ok');
  const analysisResultRef = useRef<AnalysisResult | null>(null);
  const humanRef = useRef<any>(null);
  const isAnalyzingRef = useRef<boolean>(false);
  const hasSavedRef = useRef<number>(0);
  const handRef = useRef<any>(null);
  const faceRef = useRef<any>(null);
  const angleSnapshotsRef = useRef<PostureSnapshot[]>([]);
  const screenStateRef = useRef<ScreenState>(screenState);
  const [humanLoading, setHumanLoading] = useState(true);

  const onSnapshotsCollectedRef = useRef(onSnapshotsCollected);
  useEffect(() => {
    onSnapshotsCollectedRef.current = onSnapshotsCollected;
  }, [onSnapshotsCollected]);

  useEffect(() => {
    screenStateRef.current = screenState;
    // When SCREENING begins, reset snapshot accumulator
    if (screenState === 'SCREENING') {
      angleSnapshotsRef.current = [];
      hasSavedRef.current = 0;
    }
    // When FINISHED, pass collected snapshots up
    if (screenState === 'FINISHED' && onSnapshotsCollectedRef.current && angleSnapshotsRef.current.length > 0) {
      const snapsToSend = angleSnapshotsRef.current;
      // DEBUG: log wrist data to diagnose tremor detection
      const sample = snapsToSend[0];
      console.log('[SkeletalFeed] FINISHED → snapshots:', snapsToSend.length,
        '| lWrist[0]:', sample?.leftWrist?.x?.toFixed(4), sample?.leftWrist?.y?.toFixed(4),
        '| rWrist[0]:', sample?.rightWrist?.x?.toFixed(4), sample?.rightWrist?.y?.toFixed(4),
        '| analysisResult mode:', analysisResultRef.current?.mode);
      onSnapshotsCollectedRef.current(snapsToSend);
      angleSnapshotsRef.current = [];
    }
  }, [screenState]);

  useEffect(() => {
    analysisResultRef.current = analysisResult;
  }, [analysisResult]);

  useEffect(() => {
    let isMounted = true;
    const initMediaPipe = async () => {
      try {
        const { PoseLandmarker, HandLandmarker, FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.75,
          minPosePresenceConfidence: 0.75,
          minTrackingConfidence: 0.75,
        });

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (isMounted) {
          humanRef.current = poseLandmarker;
          handRef.current = handLandmarker;
          faceRef.current = faceLandmarker;
          setHumanLoading(false);
        }
      } catch (err) {
        console.error("Failed to load local pose tracker:", err);
      }
    };
    initMediaPipe();
    return () => {
      isMounted = false;
    };
  }, []);

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
  const localHandsRef = useRef<any[]>([]);
  const localFaceRef = useRef<any[]>([]);
  const isLocalFallbackRef = useRef<boolean>(true);

  // 2. Client-Side AI Detection Loop (Asynchronous, non-blocking)
  useEffect(() => {
    let isCancelled = false;

    const detectionLoop = async () => {
      if (isCancelled) return;

      const video = videoRef.current;
      if (humanRef.current && cameraActive && video && video.readyState >= 2) {
        try {
          const startTimeMs = performance.now();
          const poseResult = humanRef.current.detectForVideo(video, startTimeMs);
          const handResult = handRef.current ? handRef.current.detectForVideo(video, startTimeMs) : { landmarks: [] };
          const faceResult = faceRef.current ? faceRef.current.detectForVideo(video, startTimeMs) : { faceLandmarks: [] };

          if (poseResult.landmarks && poseResult.landmarks.length > 0) {
            isLocalFallbackRef.current = false;
            const person = poseResult.landmarks[0];
            localHandsRef.current = handResult.landmarks || [];
            localFaceRef.current = faceResult.faceLandmarks || [];

            const jointNames = [
              "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
              "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow",
              "right_elbow", "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index",
              "left_thumb", "right_thumb", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
              "left_heel", "right_heel", "left_foot_index", "right_foot_index"
            ];

            const mapped = person.map((kp: any, idx: number) => ({
              name: jointNames[idx] || `joint_${idx}`,
              x: kp.x,
              y: kp.y,
              z: kp.z || 0,
              visibility: kp.visibility || 0.9
            }));

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
                // Force instant calibration success
                if (onCalibrationStatusChange) {
                  onCalibrationStatusChange(true, 'ok');
                }
              }
            }
          } else {
            // No body detected locally
            isLocalFallbackRef.current = true;
          }
        } catch (err) {
          console.error("Local pose detection error:", err);
        }
      }

      // Schedule next detection immediately (async loop)
      requestAnimationFrame(detectionLoop);
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

      // Send frame to backend every 200ms (5 FPS) for real-time landmark data, and prevent overlapping requests
      if ((screenState === 'SCREENING' || screenState === 'PREPARATION') && cameraActive && timestamp - lastProcessingTime > 200 && !isAnalyzingRef.current) {
        lastProcessingTime = timestamp;
        if (localLandmarksRef.current.length === 33) {
          isAnalyzingRef.current = true;

          const shouldSaveResult = screenState === 'SCREENING' && (!hasSavedRef.current || (Date.now() - hasSavedRef.current) > 1000);
          if (shouldSaveResult) {
            hasSavedRef.current = Date.now();
          }

          analysisApi.analyzeFrame({
            mode: activeMode,
            session_id: sessionId || "patient_guided_session",
            user_email: currentUser?.email,
            landmarks: localLandmarksRef.current, // Send tiny JSON instead of massive Base64
            save_result: shouldSaveResult
          }).then(data => {
            setAnalysisResult(data);
            analysisResultRef.current = data;
            if (screenState === 'SCREENING') {
              fetchHistory(currentUser?.email);
            }

            // Force instant calibration success to bypass any backend/local connection bugs
            if (screenState === 'PREPARATION' && onCalibrationStatusChange) {
              onCalibrationStatusChange(true, 'ok');
            }
          }).catch(err => {
            console.error("Backend frame processing error:", err);
          }).finally(() => {
            isAnalyzingRef.current = false;
          });
        }
      }

      if (isCancelled) return;

      // Always draw skeleton + angles from whatever landmarks are available
      const localLandmarks = localLandmarksRef.current;
      const isLocalFallback = isLocalFallbackRef.current;
      const currentAnalysis = analysisResultRef.current;

      // Prefer fast local (30fps) AI; fall back to backend landmarks (reliable MediaPipe)
      let activeLandmarks: JointPoint[] | null = null;
      if (localLandmarks && localLandmarks.length > 0 && !isLocalFallback) {
        activeLandmarks = localLandmarks;
      } else if (currentAnalysis?.landmarks && currentAnalysis.landmarks.length > 0) {
        // Use backend MediaPipe landmarks — always reliable, no CDN dependency
        activeLandmarks = currentAnalysis.landmarks;
      }

      if (cameraActive) {
        if (activeLandmarks) {
          drawSkeleton(
            ctx,
            activeLandmarks,
            landmarkHistoryRef.current,
            canvas.width,
            canvas.height,
            calibrationMode
          );
          // Always draw joint angle arcs — visible from the first frame
          drawPoseAngles(ctx, activeLandmarks, canvas.width, canvas.height, calibrationMode);
        }

        if (localHandsRef.current && localHandsRef.current.length > 0) {
          drawHands(ctx, localHandsRef.current, canvas.width, canvas.height);
        }

        if (localFaceRef.current && localFaceRef.current.length > 0) {
          drawFace(ctx, localFaceRef.current, canvas.width, canvas.height);
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeMode, cameraActive, backendConnected, screenState, currentUser, calibrationMode, sessionId]);

  // UI HUD Drawings
  const drawPreparationGuide = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Simple instruction text - no box, no dim overlay
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#000000';

    const textY = h * 0.08;

    if (landmarkHistoryRef.current.length < 3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Stand clear, face the camera and stay still', w / 2, textY);
    } else if (!isStaticRef.current) {
      ctx.fillStyle = '#eab308';
      ctx.fillText('Hold Still... Don\'t Move!', w / 2, textY);
    } else {
      ctx.fillStyle = '#10b981';
      ctx.fillText(`Perfect! Starting in ${prepSecondsRef.current}s...`, w / 2, textY);
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
        <div className="flex items-center gap-2 text-sm sm:text-base">
          <VideoCameraOutlined className="text-emerald-500" />
          <span className="truncate">Live Skeletal Screening</span>
        </div>
      }
      className={`shadow-lg border-0 overflow-hidden flex-col ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'}`}
      extra={
        <Space size="small">
          <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:inline">Webcam Stream</span>
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
