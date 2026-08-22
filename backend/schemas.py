from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict

class UserRegister(BaseModel):
    name: str
    gender: str
    age: int
    birthday: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class JointPoint(BaseModel):
    name: str
    x: float
    y: float
    z: Optional[float] = None
    visibility: Optional[float] = None

class FrameRequest(BaseModel):
    session_id: str
    mode: str  # "posture", "tremor", "exercise"
    image_base64: Optional[str] = None
    landmarks: Optional[List[JointPoint]] = None
    user_email: Optional[str] = None
    save_result: Optional[bool] = False  # Only True during SCREENING phase

class AnalysisResponse(BaseModel):
    mode: str
    status: str
    score: float
    recommendation: str
    prediction: Optional[str] = None
    explanation: Optional[str] = None
    landmarks: List[JointPoint]
    metrics: Dict[str, float]
    timestamp: float
    is_fallback: Optional[bool] = False

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    password: str

class ChangePasswordRequest(BaseModel):
    email: str
    old_password: str
    new_password: str
