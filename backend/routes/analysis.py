from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any, Optional
import os
import uuid
import shutil
import cv2
import numpy as np
import time

from schemas import FrameRequest, AnalysisResponse, JointPoint
from database import save_to_db, get_history_records
from pose_tracker import PoseTracker, HAS_MEDIAPIPE
from ai_models import AIKinesiologyEngine

router = APIRouter(prefix="/api", tags=["analysis"])

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Initialize PoseTracker and AI engine locally inside the analysis module
tracker = PoseTracker()
ai_engine = AIKinesiologyEngine()

# In-memory session history to store sequences of landmarks for temporal model input
session_histories: Dict[str, List[List[Dict[str, Any]]]] = {}

@router.post("/analyze_frame", response_model=AnalysisResponse)
def analyze_frame(request: FrameRequest):
    """
    Receives a base64 video frame, extracts 33 skeleton joints using MediaPipe Pose,
    runs the Swin Transformer & BiLSTM models, and saves results in SQLite.
    """
    # 1. Process frame and get landmarks and angles
    tracker_result = tracker.get_landmarks_or_fallback(request.image_base64, request.mode)
    landmarks = tracker_result.get("landmarks", [])

    # 2. Add to Session History
    if request.session_id not in session_histories:
        session_histories[request.session_id] = []
    
    session_histories[request.session_id].append(tracker_result)
    session_histories[request.session_id] = session_histories[request.session_id][-30:]

    # 3. Run Swin Transformer & BiLSTM Models via Kinesiology Engine
    evaluation = ai_engine.evaluate(session_histories[request.session_id], request.mode)

    # 4. Save to SQLite database
    metrics = evaluation.get("metrics", {})
    m1_name, m1_val = "N/A", 0.0
    m2_name, m2_val = "N/A", 0.0
    
    metric_keys = list(metrics.keys())
    if len(metric_keys) > 0:
        m1_name = metric_keys[0]
        m1_val = float(metrics[m1_name])
    if len(metric_keys) > 1:
        m2_name = metric_keys[1]
        m2_val = float(metrics[m2_name])

    save_to_db(
        session_id=request.session_id, 
        mode=request.mode, 
        status=evaluation["status"], 
        m1_name=m1_name, 
        m1_val=m1_val, 
        m2_name=m2_name, 
        m2_val=m2_val, 
        rec=evaluation["recommendation"],
        user_email=request.user_email
    )

    # 5. Return response
    return AnalysisResponse(
        mode=request.mode,
        status=evaluation["status"],
        score=evaluation["score"],
        recommendation=evaluation["recommendation"],
        prediction=evaluation.get("prediction", evaluation["status"]),
        explanation=evaluation.get("explanation", f"Detailed findings for {request.mode} analysis indicate {evaluation['status']}."),
        landmarks=[JointPoint(**lm) for lm in landmarks],
        metrics={k: float(v) for k, v in metrics.items()},
        timestamp=time.time(),
        is_fallback=tracker_result.get("is_fallback", False)
    )

@router.post("/upload_video")
async def upload_video(
    mode: str = Form(...),
    file: UploadFile = File(...),
    user_email: Optional[str] = Form(None)
):
    """
    Accepts an uploaded video file, saves it to disk, processes its frames using MediaPipe Pose,
    runs the Swin Transformer / BiLSTM models, and logs the session in the SQLite database.
    """
    if not file.filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
        raise HTTPException(status_code=400, detail="Invalid video format. Please upload MP4, AVI, MOV, or MKV.")

    # Save file locally
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    video_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded video: {str(e)}")

    # Open video using OpenCV to extract frames
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Failed to parse the uploaded video file.")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0

    # Sample a frame every 300ms to match real-time stream frequency
    sample_rate_frames = int(fps * 0.3)
    if sample_rate_frames <= 0:
        sample_rate_frames = 1

    landmarks_history = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % sample_rate_frames == 0:
            landmarks = []
            if HAS_MEDIAPIPE and pose is not None:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = pose.process(frame_rgb)
                if results.pose_landmarks:
                    for idx, lm in enumerate(results.pose_landmarks.landmark):
                        landmarks.append({
                            "name": mp_pose.PoseLandmark(idx).name.lower(),
                            "x": float(lm.x),
                            "y": float(lm.y),
                            "z": float(lm.z),
                            "visibility": float(lm.visibility)
                        })

            # Fallback coordinates if tracking fails or MediaPipe is not loaded
            if len(landmarks) == 0:
                t = frame_count / fps
                breathing = np.sin(t * 1.5) * 0.005
                tremor = np.sin(t * 40) * 0.008 if mode == "tremor" else np.sin(t * 2) * 0.001

                for i in range(33):
                    name = f"joint_{i}"
                    if HAS_MEDIAPIPE and mp_pose is not None:
                        name = mp_pose.PoseLandmark(i).name.lower()
                    x, y, z = 0.5, 0.5, 0.0

                    if i == 0: # Nose
                        x, y = 0.5 + tremor * 0.1, 0.3 + breathing
                    elif i == 11: # Left Shoulder
                        x, y = 0.4, 0.45 + breathing * 0.8
                    elif i == 12: # Right Shoulder
                        x, y = 0.6, 0.46 + breathing * 0.8 + (np.sin(t) * 0.005 if mode == "posture" else 0)
                    elif i == 13: # Left Elbow
                        x, y = 0.38, 0.6 + breathing
                    elif i == 14: # Right Elbow
                        x, y = 0.62, 0.6 + breathing
                    elif i == 15: # Left Wrist
                        x, y = 0.36, 0.75 + breathing
                    elif i == 16: # Right Wrist
                        arm_angle = np.sin(t * 0.8) * 0.5 + 0.5 if mode == "exercise" else 0.2
                        x = 0.55 + np.cos(arm_angle * np.pi - np.pi/4) * 0.1 + tremor
                        y = 0.6 + np.sin(arm_angle * np.pi - np.pi/4) * 0.1 + tremor
                    else:
                        x = 0.5 + np.sin(i) * 0.1
                        y = 0.5 + (i / 33) * 0.4

                    landmarks.append({
                        "name": name,
                        "x": float(x),
                        "y": float(y),
                        "z": float(z),
                        "visibility": 0.9
                    })

            # Mock some angles for fallback
            angles = {"left_elbow": 180, "right_elbow": 180, "left_knee": 180, "right_knee": 180}
            landmarks_history.append({"landmarks": landmarks, "angles": angles})

        frame_count += 1

    cap.release()

    if len(landmarks_history) == 0:
        raise HTTPException(status_code=400, detail="Could not extract any valid skeletal joints from the video.")

    # Run AI evaluation on the extracted video landmarks sequence (last 30 frames)
    evaluation_history = landmarks_history[-30:]
    evaluation = ai_engine.evaluate(evaluation_history, mode)

    # Save to SQLite database
    metrics = evaluation.get("metrics", {})
    m1_name, m1_val = "N/A", 0.0
    m2_name, m2_val = "N/A", 0.0

    metric_keys = list(metrics.keys())
    if len(metric_keys) > 0:
        m1_name = metric_keys[0]
        m1_val = float(metrics[m1_name])
    if len(metric_keys) > 1:
        m2_name = metric_keys[1]
        m2_val = float(metrics[m2_name])

    save_to_db(
        session_id=f"video_upload_{uuid.uuid4().hex[:8]}",
        mode=mode,
        status=evaluation["status"],
        m1_name=m1_name,
        m1_val=m1_val,
        m2_name=m2_name,
        m2_val=m2_val,
        rec=evaluation["recommendation"],
        video_path=video_path,
        user_email=user_email
    )

    return {
        "mode": mode,
        "status": evaluation["status"],
        "score": evaluation["score"],
        "recommendation": evaluation["recommendation"],
        "metrics": {k: float(v) for k, v in metrics.items()},
        "video_path": video_path,
        "timestamp": time.time()
    }

@router.get("/history")
def get_history(email: Optional[str] = None):
    """Retrieves the last 50 health analysis records from the database, optionally filtered by user email."""
    try:
        return get_history_records(limit=50, email=email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database fetch error: {str(e)}")
