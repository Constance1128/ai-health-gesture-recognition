import base64
import cv2
import numpy as np
import time
import os
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from typing import List, Dict, Any

# Path to the task model file
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'pose_landmarker.task')

# Check if model is downloaded
if not os.path.exists(MODEL_PATH):
    # Try downloading it
    import urllib.request
    try:
        url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
        urllib.request.urlretrieve(url, MODEL_PATH)
    except Exception as e:
        print(f"Failed to download pose landmarker model: {e}")

HAS_MEDIAPIPE = False
detector = None

if os.path.exists(MODEL_PATH):
    try:
        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            output_segmentation_masks=False,
            min_pose_detection_confidence=0.75,
            min_pose_presence_confidence=0.75,
            min_tracking_confidence=0.75
        )
        detector = vision.PoseLandmarker.create_from_options(options)
        HAS_MEDIAPIPE = True
    except Exception as e:
        print(f"MediaPipe Tasks PoseLandmarker initialization failed: {e}")

class PoseTracker:
    """
    Handles decoding base64 video frames and extracting 33 skeletal joint coordinates using MediaPipe Pose.
    """
    @staticmethod
    def calculate_angle(a, b, c):
        """Calculate the angle between three points."""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        
        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        
        if angle > 180.0:
            angle = 360.0 - angle
            
        return angle

    @staticmethod
    def decode_base64_image(image_base64: str) -> np.ndarray:
        """Decodes a base64 image string into a OpenCV image (NumPy array)."""
        header, encoded = image_base64.split(",", 1) if "," in image_base64 else ("", image_base64)
        image_data = base64.b64decode(encoded)
        np_arr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode image.")
        return frame

    def extract_landmarks(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Extracts 33 skeletal landmarks using MediaPipe."""
        landmarks = []
        if HAS_MEDIAPIPE and detector is not None:
            try:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                results = detector.detect(mp_image)
                
                if results.pose_landmarks and len(results.pose_landmarks) > 0:
                    person_landmarks = results.pose_landmarks[0]
                    joint_names = [
                        "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
                        "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow",
                        "right_elbow", "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index",
                        "left_thumb", "right_thumb", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
                        "left_heel", "right_heel", "left_foot_index", "right_foot_index"
                    ]
                    for idx, lm in enumerate(person_landmarks):
                        name = joint_names[idx] if idx < len(joint_names) else f"joint_{idx}"
                        landmarks.append({
                            "name": name,
                            "x": float(lm.x),
                            "y": float(lm.y),
                            "z": float(lm.z),
                            "visibility": float(lm.visibility) if hasattr(lm, 'visibility') else 0.9
                        })
            except Exception as e:
                print(f"Error in backend pose extraction: {e}")
        return landmarks

    def get_landmarks_or_fallback(self, image_base64: str, mode: str) -> List[Dict[str, Any]]:
        """
        Processes a base64 image frame and returns landmarks.
        """
        try:
            frame = self.decode_base64_image(image_base64)
            landmarks = self.extract_landmarks(frame)
        except Exception as e:
            print(f"Frame decode error, using fallback: {e}")
            landmarks = []

        # Fallback tracking if no landmarks detected
        is_fallback = False
        if len(landmarks) == 0:
            is_fallback = True
            landmarks = []
                
        # Calculate angles
        angles = {}
            
        if len(landmarks) >= 33:
            def get_pt(idx):
                return [landmarks[idx]["x"], landmarks[idx]["y"]]
            
            # Left arm (shoulder 11, elbow 13, wrist 15)
            angles["left_elbow"] = self.calculate_angle(get_pt(11), get_pt(13), get_pt(15))
            # Right arm (shoulder 12, elbow 14, wrist 16)
            angles["right_elbow"] = self.calculate_angle(get_pt(12), get_pt(14), get_pt(16))
            # Left leg (hip 23, knee 25, ankle 27)
            angles["left_knee"] = self.calculate_angle(get_pt(23), get_pt(25), get_pt(27))
            # Right leg (hip 24, knee 26, ankle 28)
            angles["right_knee"] = self.calculate_angle(get_pt(24), get_pt(26), get_pt(28))
            
        return {"landmarks": landmarks, "angles": angles, "is_fallback": is_fallback}
