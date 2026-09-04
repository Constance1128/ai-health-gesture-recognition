from fastapi import APIRouter, HTTPException, Response
from typing import Dict, Any

from database import get_user_by_email, get_all_users, verify_doctor, get_doctor_document, log_audit_action, get_audit_logs

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users")
def admin_get_users(email: str):
    """Retrieve all users. Requires admin role."""
    user = get_user_by_email(email)
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
    return get_all_users()

@router.post("/verify-doctor")
def admin_verify_doctor(request: Dict[str, Any]):
    """Verify a doctor's account. Requires admin role."""
    admin_email = request.get("admin_email")
    doctor_id = request.get("doctor_id")
    
    user = get_user_by_email(admin_email)
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
        
    success = verify_doctor(doctor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to verify doctor.")
        
    log_audit_action(user["id"], "Verified Doctor", f"Doctor ID: {doctor_id}")
    return {"message": "Doctor verified successfully."}

@router.get("/audit-logs")
def admin_get_audit_logs(email: str):
    user = get_user_by_email(email)
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
    return get_audit_logs()

@router.get("/view-document/{doctor_id}")
def view_document(doctor_id: int):
    """Serves the doctor's verification document directly from the database BLOB."""
    blob = get_doctor_document(doctor_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    # Detect media type from magic bytes
    media_type = "image/jpeg"
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        media_type = "image/png"
        
    return Response(content=blob, media_type=media_type)
