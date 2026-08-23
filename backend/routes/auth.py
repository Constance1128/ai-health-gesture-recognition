from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel
import time
import uuid
import os
import shutil
import urllib.parse

from schemas import UserRegister, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
from database import (
    get_user_by_email, create_user, create_doctor_user, hash_password, 
    save_reset_token, get_user_by_reset_token, update_user_password,
    update_user_profile_picture, get_user_profile_picture, update_user_name
)

router = APIRouter(prefix="/api", tags=["authentication"])

# Define UPLOAD_DIR (shared with main)
UPLOAD_DIR = "uploads"

@router.post("/register")
def register_user(user: UserRegister):
    """Registers a new user."""
    existing = get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    
    success = create_user(
        name=user.name,
        gender=user.gender,
        age=user.age,
        birthday=user.birthday,
        email=user.email,
        password_raw=user.password
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to register user. Please try again.")
    
    return {"message": "User registered successfully"}

@router.post("/profile/picture")
def upload_profile_picture(
    email: str = Form(...),
    file: UploadFile = File(...)
):
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    file_blob = file.file.read()
    success = update_user_profile_picture(user["id"], file_blob)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update profile picture")
    return {"message": "Profile picture updated"}

@router.get("/profile/picture/{user_id}")
def get_profile_picture(user_id: int):
    blob = get_user_profile_picture(user_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Picture not found")
    # Using a generic media type or determining it from bytes could be better, but we will use image/jpeg as default
    return Response(content=blob, media_type="image/jpeg")

@router.delete("/profile/picture/{user_id}")
def delete_profile_picture(user_id: int):
    success = update_user_profile_picture(user_id, None)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove profile picture")
    return {"message": "Profile picture removed"}

class UpdateNameRequest(BaseModel):
    user_id: int
    name: str

@router.put("/profile/name")
def update_profile_name(request: UpdateNameRequest):
    success = update_user_name(request.user_id, request.name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update name")
    return {"message": "Name updated successfully"}

@router.post("/register-doctor")
async def register_doctor(
    name: str = Form(...),
    gender: str = Form(...),
    age: int = Form(...),
    birthday: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    specialization: str = Form(...),
    medical_license: str = Form(...),
    file: UploadFile = File(...)
):
    """Registers a new doctor and saves their uploaded license/certificate to the database."""
    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    
    if not file.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload JPG, JPEG, or PNG image.")
        
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")
        
    success = create_doctor_user(
        name=name,
        gender=gender,
        age=age,
        birthday=birthday,
        email=email,
        password_raw=password,
        specialization=specialization,
        medical_license=medical_license,
        verification_document_blob=contents
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to register professional. Please try again.")
        
    return {"message": "Professional registration submitted successfully. Awaiting administrator verification."}

@router.post("/login")
def login_user(credentials: UserLogin):
    """Authenticates a user and returns their details."""
    user = get_user_by_email(credentials.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password.")
    
    hashed_input = hash_password(credentials.password)
    if user["password_hash"] != hashed_input:
        raise HTTPException(status_code=400, detail="Invalid email or password.")
    
    return {
        "id": user["id"],
        "name": user["name"],
        "gender": user["gender"],
        "age": user["age"],
        "birthday": user["birthday"],
        "email": user["email"],
        "role": user["role"],
        "is_verified": user["is_verified"]
    }

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    """Generates a password reset token and returns a simulated email link."""
    user = get_user_by_email(request.email)
    if not user:
        raise HTTPException(status_code=400, detail="No account found with this email address.")
    
    token = str(uuid.uuid4())
    expiry = time.time() + 3600  # 1 hour
    
    success = save_reset_token(request.email, token, expiry)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to generate reset link. Please try again.")
    
    simulated_link = f"http://localhost:5173/?token={token}&email={urllib.parse.quote(request.email)}"
    print(f"\n[SIMULATED EMAIL] Password reset requested for {request.email}. Link: {simulated_link}\n")
    
    return {
        "message": "A simulated password reset link has been generated. In a production app, this would be sent to your email.",
        "simulated_link": simulated_link
    }

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest):
    """Resets the user's password if the token is valid and not expired."""
    user = get_user_by_reset_token(request.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    
    if user["email"].lower() != request.email.lower():
        raise HTTPException(status_code=400, detail="Invalid token for this email address.")
    
    if time.time() > user["reset_token_expiry"]:
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")
    
    success = update_user_password(request.email, request.password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password. Please try again.")
    
    return {"message": "Your password has been successfully reset. You can now log in."}

@router.post("/change-password")
def change_password(request: ChangePasswordRequest):
    """Changes the password for an already authenticated user."""
    user = get_user_by_email(request.email)
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")
    
    hashed_old = hash_password(request.old_password)
    if user["password_hash"] != hashed_old:
        raise HTTPException(status_code=400, detail="Incorrect old password.")
        
    success = update_user_password(request.email, request.new_password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password.")
        
    return {"message": "Password changed successfully."}
