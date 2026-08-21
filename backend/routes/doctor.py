from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any

from database import (
    get_user_by_email, get_patients_for_doctor, get_history_records, 
    get_doctors_for_patient, toggle_doctor_permission,
    update_doctor_profile, create_appointment, get_appointments_for_doctor,
    get_appointments_for_patient, update_appointment_status,
    get_doctor_schedule, update_doctor_schedule, get_schedule_overrides,
    add_schedule_override, delete_schedule_override, get_notifications,
    create_notification, check_doctor_permission
)

router = APIRouter(prefix="/api", tags=["clinician_and_patient"])

@router.get("/doctor/patients")
def doctor_get_patients(email: str):
    """Retrieve all patients who have granted permission. Requires professional role."""
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
    if user["is_verified"] != 1:
        raise HTTPException(status_code=403, detail="Account is pending verification.")
    return get_patients_for_doctor(user["id"])

@router.get("/doctor/patient-history")
def doctor_get_patient_history(email: str, patient_email: str):
    """Retrieve history for a specific patient. Requires professional role."""
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
    if user["is_verified"] != 1:
        raise HTTPException(status_code=403, detail="Account is pending verification.")
    patient = get_user_by_email(patient_email)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    if not check_doctor_permission(patient["id"], user["id"]):
        raise HTTPException(status_code=403, detail="No permission to view this patient's records.")
        
    return get_history_records(limit=50, email=patient_email)

@router.get("/patient/doctors")
def patient_get_doctors(email: str):
    """Retrieve all verified doctors and permission status for a patient."""
    user = get_user_by_email(email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
    return get_doctors_for_patient(user["id"])

@router.post("/patient/toggle-permission")
def toggle_permission(payload: Dict[str, Any] = Body(...)):
    """Toggles permission for a specific doctor."""
    patient_email = payload.get("email")
    doctor_id = payload.get("doctor_id")
    grant = payload.get("grant")
    
    if patient_email is None or doctor_id is None or grant is None:
        raise HTTPException(status_code=400, detail="Missing required fields.")
        
    user = get_user_by_email(patient_email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized access.")
        
    success = toggle_doctor_permission(user["id"], doctor_id, grant)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to toggle permission.")
    
    return {"message": "Permission updated successfully."}

@router.put("/doctor/profile")
def doctor_update_profile(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    bio = payload.get("bio", "")
    clinic_name = payload.get("clinic_name", "")
    consultation_hours = payload.get("consultation_hours", "")

    if not email:
        raise HTTPException(status_code=400, detail="Missing email.")
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
    
    success = update_doctor_profile(user["id"], bio, clinic_name, consultation_hours)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update profile.")
    return {"message": "Profile updated successfully."}

@router.post("/patient/book")
def patient_book_appointment(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    doctor_id = payload.get("doctor_id")
    date = payload.get("date")
    time_str = payload.get("time")
    notes = payload.get("notes", "")

    if not all([email, doctor_id, date, time_str]):
        raise HTTPException(status_code=400, detail="Missing required fields.")

    user = get_user_by_email(email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    appt = create_appointment(doctor_id, user["id"], date, time_str, notes)
    if not appt:
        raise HTTPException(status_code=500, detail="Failed to book appointment.")
    return appt

@router.get("/doctor/appointments")
def doctor_get_appointments(email: str):
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
    return get_appointments_for_doctor(user["id"])

@router.get("/patient/appointments")
def patient_get_appointments(email: str):
    user = get_user_by_email(email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized.")
    return get_appointments_for_patient(user["id"])

@router.put("/doctor/appointment/status")
def doctor_update_appointment_status(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    appointment_id = payload.get("appointment_id")
    status = payload.get("status")

    if not all([email, appointment_id, status]):
        raise HTTPException(status_code=400, detail="Missing required fields.")
        
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    success = update_appointment_status(appointment_id, user["id"], status)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update appointment status.")
    return {"message": f"Appointment status updated to {status}."}

@router.get("/doctor/schedule")
def get_schedule(email: str):
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
    return get_doctor_schedule(user["id"])

@router.put("/doctor/schedule")
def update_schedule(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    schedules = payload.get("schedules", [])
    
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    success = update_doctor_schedule(user["id"], schedules)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update schedule.")
    return {"message": "Schedule updated successfully."}

@router.get("/doctor/schedule/overrides")
def get_overrides(email: str):
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
    return get_schedule_overrides(user["id"])

@router.post("/doctor/schedule/override")
def add_override(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    date = payload.get("date")
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    override_type = payload.get("type", "blocked")
    reason = payload.get("reason", "")
    
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    success = add_schedule_override(user["id"], date, start_time, end_time, override_type, reason)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to add override.")
        
    # TODO: Cancel conflicting appointments and send notifications here
    return {"message": "Override added successfully."}

@router.delete("/doctor/schedule/override")
def delete_override(email: str, override_id: int):
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    success = delete_schedule_override(override_id, user["id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete override.")
    return {"message": "Override deleted successfully."}

@router.get("/notifications")
def get_user_notifications(email: str):
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=403, detail="Unauthorized.")
    return get_notifications(user["id"])

@router.put("/patient/appointment/reschedule")
def reschedule_appointment(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    appointment_id = payload.get("appointment_id")
    date = payload.get("date")
    time_str = payload.get("time")

    if not all([email, appointment_id, date, time_str]):
        raise HTTPException(status_code=400, detail="Missing fields.")

    user = get_user_by_email(email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    import datetime
    try:
        appt_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        today = datetime.date.today()
        if (appt_date - today).days < 3:
            raise HTTPException(status_code=400, detail="Must reschedule at least 3 days in advance.")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        pass

    import sqlite3
    conn = None
    try:
        from database import DB_FILE
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        
        cursor.execute("SELECT doctor_id FROM appointments WHERE id = ? AND patient_id = ?", (appointment_id, user["id"]))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Appointment not found.")
            
        doctor_id = row[0]

        cursor.execute("UPDATE appointments SET date = ?, time = ?, status = 'pending' WHERE id = ? AND patient_id = ?", (date, time_str, appointment_id, user["id"]))
        conn.commit()
        
        # Create notification for doctor
        from database import create_notification
        create_notification(doctor_id, "Appointment Rescheduled", f"Patient {user['name']} rescheduled their appointment to {date} at {time_str}.")
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail="Database error.")
    finally:
        if conn: conn.close()
        
    return {"message": "Rescheduled successfully."}
