from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, Optional

from database import (
    get_user_by_email, get_patients_for_doctor, get_history_records, 
    get_doctors_for_patient, toggle_doctor_permission,
    update_doctor_profile, create_appointment, get_appointments_for_doctor,
    get_appointments_for_patient, update_appointment_status,
    get_doctor_schedule, update_doctor_schedule, get_schedule_overrides,
    add_schedule_override, delete_schedule_override, get_notifications,
    create_notification, check_doctor_permission,
    mark_notification_read, mark_all_notifications_read, delete_all_notifications,
    save_consultation_note, get_consultation_notes, get_all_consultation_notes_for_doctor, delete_consultation_note,
    get_consultation_notes_for_patient
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
    email = payload.get("email") or payload.get("patient_email")
    doctor_id = payload.get("doctor_id")
    date = payload.get("date")
    time_str = payload.get("time")
    notes = payload.get("notes", "")
    consultation_type = payload.get("consultation_type", "online")

    if not all([email, doctor_id, date, time_str]):
        raise HTTPException(status_code=400, detail="Missing required fields.")

    user = get_user_by_email(email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    appt = create_appointment(doctor_id, user["id"], date, time_str, notes, consultation_type)
    if not appt:
        raise HTTPException(status_code=500, detail="Failed to book appointment.")
    
    # Notify doctor of incoming appointment request
    type_label = "Online Video Consultation" if consultation_type == "online" else "Physical In-Clinic Consultation"
    create_notification(doctor_id, "New Appointment Request", f"Patient {user['name']} requested an {type_label} on {date} at {time_str}.")
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

@router.post("/doctor/appointment/status")
@router.put("/doctor/appointment/status")
def doctor_update_appointment_status(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    appointment_id = payload.get("appointment_id")
    status = payload.get("status")
    reason = payload.get("reason")

    if not all([email, appointment_id, status]):
        raise HTTPException(status_code=400, detail="Missing required fields.")
        
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    import sqlite3
    conn = None
    try:
        from database import DB_FILE, create_notification
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()

        cursor.execute("SELECT patient_id, date, time, notes FROM appointments WHERE id = ? AND doctor_id = ?", (appointment_id, user["id"]))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Appointment not found.")

        patient_id, appt_date, appt_time, existing_notes = row[0], row[1], row[2], row[3] or ""

        if status.lower() == 'cancelled' and reason:
            updated_notes = f"{existing_notes} [Declined by Doctor: {reason}]".strip()
            cursor.execute("UPDATE appointments SET status = 'cancelled', notes = ? WHERE id = ? AND doctor_id = ?", (updated_notes, appointment_id, user["id"]))
            create_notification(patient_id, "Appointment Declined", f"Dr. {user['name']} has declined your appointment on {appt_date} at {appt_time}. Reason: {reason}. You can book a new appointment.")
        else:
            cursor.execute("UPDATE appointments SET status = ? WHERE id = ? AND doctor_id = ?", (status, appointment_id, user["id"]))
            if status.lower() == 'confirmed':
                create_notification(patient_id, "Appointment Confirmed", f"Dr. {user['name']} has confirmed your appointment on {appt_date} at {appt_time}.")

        conn.commit()
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        if conn: conn.close()

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

def handle_override_conflicts_and_auto_reschedule(doctor_id: int, doctor_name: str, blocked_date: str, start_time: str, end_time: str, reason: str):
    """
    Finds conflicting active appointments during the blocked period.
    Automatically reschedules each appointment to the doctor's next available date for the same time slot,
    or cancels with a notification if no slot is found.
    """
    import datetime
    import sqlite3
    from database import DB_FILE, create_notification
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Fetch conflicting appointments on blocked_date
        cursor.execute("""
            SELECT id, patient_id, date, time, status, notes
            FROM appointments
            WHERE doctor_id = ? AND date = ? AND status != 'cancelled'
        """, (doctor_id, blocked_date))
        appointments = [dict(row) for row in cursor.fetchall()]

        conflicting = []
        for appt in appointments:
            appt_time = appt['time']
            # If full-day block or time slot overlaps
            if start_time == '00:00' and (end_time == '23:59' or end_time >= '23:00'):
                conflicting.append(appt)
            elif (start_time <= appt_time <= end_time) or (appt_time < end_time and start_time < appt_time):
                conflicting.append(appt)

        if not conflicting:
            return

        # 2. Fetch doctor's weekly timetable & all schedule overrides
        cursor.execute("SELECT * FROM doctor_schedule WHERE doctor_id = ?", (doctor_id,))
        raw_schedules = [dict(row) for row in cursor.fetchall()]
        active_schedules = [s for s in raw_schedules if not s.get('effective_end_date')]

        cursor.execute("SELECT * FROM schedule_overrides WHERE doctor_id = ?", (doctor_id,))
        all_overrides = [dict(row) for row in cursor.fetchall()]

        # Fetch all active appointments to avoid double booking
        cursor.execute("SELECT id, date, time FROM appointments WHERE doctor_id = ? AND status != 'cancelled'", (doctor_id,))
        all_appts = [dict(row) for row in cursor.fetchall()]

        # 3. For each conflicting appointment, find next available date for the same time
        orig_dt = datetime.datetime.strptime(blocked_date, "%Y-%m-%d").date()

        for appt in conflicting:
            appt_id = appt['id']
            patient_id = appt['patient_id']
            appt_time = appt['time']
            orig_notes = appt.get('notes') or ""

            target_new_date = None

            # Search up to 45 days into the future starting from the next day
            for day_offset in range(1, 46):
                cand_date = orig_dt + datetime.timedelta(days=day_offset)
                cand_date_str = cand_date.strftime("%Y-%m-%d")
                cand_dow = (cand_date.weekday() + 1) % 7  # 0=Sunday, 1=Monday...

                # Check 1: Is doctor working on this day of week at this time?
                working_sched = [s for s in active_schedules if s['day_of_week'] == cand_dow]
                if not working_sched:
                    continue
                is_working_time = any(s['start_time'] <= appt_time < s['end_time'] for s in working_sched)
                if not is_working_time:
                    continue

                # Check 2: Does doctor have a schedule override on cand_date overlapping appt_time?
                has_override = False
                for ov in all_overrides:
                    if ov['date'] == cand_date_str:
                        if ov['start_time'] <= appt_time < ov['end_time'] or (ov['start_time'] == '00:00' and ov['end_time'] >= '23:00'):
                            has_override = True
                            break
                if has_override:
                    continue

                # Check 3: Is there already an appointment booked at cand_date and appt_time?
                already_booked = any(a['date'] == cand_date_str and a['time'] == appt_time and a['id'] != appt_id for a in all_appts)
                if already_booked:
                    continue

                # Available slot found
                target_new_date = cand_date_str
                all_appts.append({'id': appt_id, 'date': cand_date_str, 'time': appt_time})
                break

            if target_new_date:
                # Update appointment date
                new_note = f"[Rescheduled by Doctor from {blocked_date} due to: {reason}] {orig_notes}".strip()
                cursor.execute("""
                    UPDATE appointments
                    SET date = ?, notes = ?
                    WHERE id = ? AND doctor_id = ?
                """, (target_new_date, new_note, appt_id, doctor_id))

                # Notify patient with instructions on how to cancel/reschedule if not suitable
                notif_msg = (
                    f"Your appointment with Dr. {doctor_name} on {blocked_date} at {appt_time} has been automatically moved to "
                    f"{target_new_date} at {appt_time} due to: {reason}. If this new date/time does not suit you, you can cancel or reschedule."
                )
                create_notification(patient_id, "Appointment Rescheduled by Doctor", notif_msg)
            else:
                # Cancel appointment if no matching slot found
                new_note = f"[Cancelled by Doctor due to: {reason}] {orig_notes}".strip()
                cursor.execute("""
                    UPDATE appointments
                    SET status = 'cancelled', notes = ?
                    WHERE id = ? AND doctor_id = ?
                """, (new_note, appt_id, doctor_id))

                # Notify patient
                notif_msg = (
                    f"Your appointment with Dr. {doctor_name} on {blocked_date} at {appt_time} was cancelled due to: {reason}. "
                    f"Please visit the doctor directory to select a new appointment slot."
                )
                create_notification(patient_id, "Appointment Cancelled by Doctor", notif_msg)

        conn.commit()
    except Exception as e:
        print(f"Error handling override conflicts: {e}")
    finally:
        if conn:
            conn.close()

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
        
    # Auto-reschedule conflicting appointments to next available slot and notify patients
    handle_override_conflicts_and_auto_reschedule(user["id"], user["name"], date, start_time, end_time, reason)
    return {"message": "Override added and conflicting appointments handled successfully."}

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

@router.put("/notifications/read-all")
def mark_all_user_notifications_read(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=403, detail="Unauthorized.")
    mark_all_notifications_read(user["id"])
    return {"message": "All notifications marked as read."}

@router.put("/notifications/{notif_id}/read")
def mark_one_notification_read(notif_id: int, payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=403, detail="Unauthorized.")
    mark_notification_read(notif_id, user["id"])
    return {"message": "Notification marked as read."}

@router.delete("/notifications/clear")
def clear_user_notifications(email: str):
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=403, detail="Unauthorized.")
    delete_all_notifications(user["id"])
    return {"message": "All notifications cleared."}

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

    import sqlite3
    conn = None
    try:
        from database import DB_FILE, create_notification
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
        create_notification(doctor_id, "Appointment Rescheduled", f"Patient {user['name']} rescheduled their appointment to {date} at {time_str}.")
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail="Database error.")
    finally:
        if conn: conn.close()
        
    return {"message": "Rescheduled successfully."}

@router.post("/patient/appointment/cancel")
@router.put("/patient/appointment/cancel")
def patient_cancel_appointment(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email") or payload.get("patient_email")
    appointment_id = payload.get("appointment_id")
    reason = payload.get("reason", "Patient requested rescheduling/cancellation")

    if not all([email, appointment_id]):
        raise HTTPException(status_code=400, detail="Missing fields.")

    user = get_user_by_email(email)
    if not user or user["role"] != "general user":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    import sqlite3
    conn = None
    try:
        from database import DB_FILE, create_notification
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        
        cursor.execute("SELECT doctor_id, date, time, notes FROM appointments WHERE id = ? AND patient_id = ?", (appointment_id, user["id"]))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Appointment not found.")
            
        doctor_id, appt_date, appt_time, existing_notes = row[0], row[1], row[2], row[3] or ""
        updated_notes = f"{existing_notes} [Cancelled by Patient: {reason}]".strip()

        cursor.execute("UPDATE appointments SET status = 'cancelled', notes = ? WHERE id = ? AND patient_id = ?", (updated_notes, appointment_id, user["id"]))
        conn.commit()
        
        # Create notification for doctor
        create_notification(doctor_id, "Appointment Cancelled", f"Patient {user['name']} cancelled appointment on {appt_date} at {appt_time}. Reason: {reason}")
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail="Database error.")
    finally:
        if conn: conn.close()
        
    return {"message": "Appointment cancelled successfully."}
 
@router.get("/doctor/consultation-notes")
def doctor_get_consultation_notes(email: str, patient_id: Optional[int] = None):
    """Retrieve consultation notes for a specific patient or all patients for this doctor."""
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized.")
    if patient_id:
        return get_consultation_notes(user["id"], patient_id)
    return get_all_consultation_notes_for_doctor(user["id"])

@router.post("/doctor/consultation-notes")
def doctor_save_consultation_note(payload: Dict[str, Any] = Body(...)):
    """Save a consultation note record for a patient."""
    email = payload.get("email")
    patient_id = payload.get("patient_id")
    diagnosis = payload.get("diagnosis", "")
    treatment = payload.get("treatment", "")
    date_str = payload.get("date")
    time_str = payload.get("time")

    if not email or not patient_id:
        raise HTTPException(status_code=400, detail="Missing required fields.")

    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    note = save_consultation_note(
        doctor_id=user["id"],
        patient_id=int(patient_id),
        diagnosis=diagnosis,
        treatment=treatment,
        date_str=date_str,
        time_str=time_str
    )
    if not note:
        raise HTTPException(status_code=500, detail="Failed to save consultation note.")

    return note

@router.delete("/doctor/consultation-notes/{note_id}")
def doctor_delete_consultation_note(note_id: int, email: str):
    """Delete a consultation note record."""
    user = get_user_by_email(email)
    if not user or user["role"] != "professional":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    success = delete_consultation_note(note_id, user["id"])
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete note.")

    return {"message": "Consultation note deleted successfully."}

@router.get("/patient/consultation-notes")
def patient_get_consultation_notes(email: str, doctor_id: Optional[int] = None):
    """Retrieve consultation notes for a patient."""
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized.")
    return get_consultation_notes_for_patient(user["id"], doctor_id)



