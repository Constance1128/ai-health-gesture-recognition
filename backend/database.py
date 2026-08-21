import os
import sqlite3
import time
import hashlib
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "health_detection.db")

def hash_password(password: str) -> str:
    """Hashes the password using PBKDF2 with SHA-256 and a constant salt."""
    salt = b"ai_health_guard_salt_123"
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return pwd_hash.hex()

def init_db():
    """Initializes the SQLite database, creating users and history tables if they don't exist."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.execute("PRAGMA journal_mode=WAL")
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                gender TEXT NOT NULL,
                age INTEGER NOT NULL,
                birthday TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        """)
        
        # Create analysis history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                timestamp REAL,
                mode TEXT,
                status TEXT,
                metric_1_name TEXT,
                metric_1_value REAL,
                metric_2_name TEXT,
                metric_2_value REAL,
                recommendation TEXT
            )
        """)
        
        # Database Migration: Add video_path column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE analysis_history ADD COLUMN video_path TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add user_email column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE analysis_history ADD COLUMN user_email TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add reset_token column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add reset_token_expiry column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token_expiry REAL")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add role column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'general user'")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Clean up and normalize roles for consistency
        try:
            cursor.execute("UPDATE users SET role = 'general user' WHERE role = 'user' OR role IS NULL OR role = ''")
            cursor.execute("UPDATE users SET role = 'professional' WHERE role = 'doctor'")
            conn.commit()
        except Exception as e:
            print(f"Error cleaning up roles: {e}")

        # Database Migration: Add specialization column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN specialization TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add medical_license column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN medical_license TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add verification_document_blob column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN verification_document_blob BLOB")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Drop old unused verification_document column if it exists
        try:
            cursor.execute("ALTER TABLE users DROP COLUMN verification_document")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add is_verified column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add profile fields to users if they don't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN bio TEXT")
            cursor.execute("ALTER TABLE users ADD COLUMN clinic_name TEXT")
            cursor.execute("ALTER TABLE users ADD COLUMN consultation_hours TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add profile_pic_blob column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN profile_pic_blob BLOB")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Create messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                content TEXT,
                file_blob BLOB,
                file_type TEXT,
                timestamp REAL,
                is_deleted INTEGER DEFAULT 0,
                is_read INTEGER DEFAULT 0
            )
        """)

        # Create doctor_permissions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctor_permissions (
                doctor_id INTEGER NOT NULL,
                patient_id INTEGER NOT NULL,
                has_permission INTEGER DEFAULT 0,
                updated_at REAL,
                PRIMARY KEY (doctor_id, patient_id)
            )
        """)

        # Create appointments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                patient_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                timestamp REAL
            )
        """)

        # Create doctor timetable tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctor_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schedule_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                type TEXT NOT NULL,
                reason TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT,
                message TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                timestamp REAL
            )
        """)

        conn.commit()
        # Database Migration: Add is_online column to users if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add video_blob column to analysis_history if it doesn't exist
        try:
            cursor.execute("ALTER TABLE analysis_history ADD COLUMN video_blob BLOB")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Database Migration: Add is_read column to messages if it doesn't exist
        try:
            cursor.execute("ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Seed default Admin user if none exists
        try:
            cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            count = cursor.fetchone()[0]
            if count == 0:
                hashed_admin_pwd = hash_password("admin123")
                cursor.execute("""
                    INSERT INTO users (name, gender, age, birthday, email, password, role, is_verified)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, ("System Administrator", "Other", 30, "1996-01-01", "admin@healthguard.com", hashed_admin_pwd, "admin", 1))
                conn.commit()
        except Exception as e:
            print(f"Error seeding admin: {e}")
            
    except Exception as e:
        print(f"Database init error: {e}")
    finally:
        if conn:
            conn.close()

def create_user(name: str, gender: str, age: int, birthday: str, email: str, password_raw: str) -> bool:
    """Registers a new user after hashing their password."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        hashed = hash_password(password_raw)
        cursor.execute("""
            INSERT INTO users (name, gender, age, birthday, email, password, role)
            VALUES (?, ?, ?, ?, ?, ?, 'general user')
        """, (name, gender, age, birthday, email.lower(), hashed))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # Email already exists
        return False
    except Exception as e:
        print(f"Error creating user: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieves a user's details by their email (excluding password hash)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, gender, age, birthday, email, password, role, specialization, medical_license, is_verified FROM users WHERE email = ?
        """, (email.lower(),))
        row = cursor.fetchone()
        if row:
            role_val = row[7] if row[7] else "general user"
            user_id = row[0]
            return {
                "id": user_id,
                "name": row[1],
                "gender": row[2],
                "age": row[3],
                "birthday": row[4],
                "email": row[5],
                "password_hash": row[6],
                "role": role_val,
                "specialization": row[8],
                "medical_license": row[9],
                "verification_document": f"/api/admin/view-document/{user_id}" if role_val == 'professional' else None,
                "is_verified": row[10] if row[10] is not None else 0
            }
        return None
    except Exception as e:
        print(f"Error getting user by email: {e}")
        return None
    finally:
        if conn:
            conn.close()

def save_reset_token(email: str, token: str, expiry: float) -> bool:
    """Saves the reset token and its expiry time for a user."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users 
            SET reset_token = ?, reset_token_expiry = ? 
            WHERE email = ?
        """, (token, expiry, email.lower()))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving reset token: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_user_by_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """Retrieves a user's details by their reset token."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, gender, age, birthday, email, reset_token, reset_token_expiry 
            FROM users 
            WHERE reset_token = ?
        """, (token,))
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "name": row[1],
                "gender": row[2],
                "age": row[3],
                "birthday": row[4],
                "email": row[5],
                "reset_token": row[6],
                "reset_token_expiry": row[7]
            }
        return None
    except Exception as e:
        print(f"Error getting user by reset token: {e}")
        return None
    finally:
        if conn:
            conn.close()

def update_user_password(email: str, password_raw: str) -> bool:
    """Updates a user's password and clears their reset token."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        hashed = hash_password(password_raw)
        cursor.execute("""
            UPDATE users 
            SET password = ?, reset_token = NULL, reset_token_expiry = NULL 
            WHERE email = ?
        """, (hashed, email.lower()))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating user password: {e}")
        return False
    finally:
        if conn:
            conn.close()

def save_to_db(session_id: str, mode: str, status: str, m1_name: str, m1_val: float, m2_name: str, m2_val: float, rec: str, video_path: str = None, user_email: str = None):
    """Saves an analysis record to the SQLite database, including optional video path and user email."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO analysis_history 
            (session_id, timestamp, mode, status, metric_1_name, metric_1_value, metric_2_name, metric_2_value, recommendation, video_path, user_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, time.time(), mode, status, m1_name, m1_val, m2_name, m2_val, rec, video_path, user_email.lower() if user_email else None))
        conn.commit()
    except Exception as e:
        print(f"Database save error: {e}")
    finally:
        if conn:
            conn.close()

def get_history_records(limit: int = 50, email: str = None) -> List[Dict[str, Any]]:
    """Retrieves the last N health analysis records from the database, optionally filtered by user email."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        
        if email:
            cursor.execute("""
                SELECT id, session_id, timestamp, mode, status, metric_1_name, metric_1_value, metric_2_name, metric_2_value, recommendation, video_path
                FROM analysis_history
                WHERE user_email = ?
                ORDER BY id DESC
                LIMIT ?
            """, (email.lower(), limit))
        else:
            cursor.execute("""
                SELECT id, session_id, timestamp, mode, status, metric_1_name, metric_1_value, metric_2_name, metric_2_value, recommendation, video_path
                FROM analysis_history
                WHERE user_email IS NULL
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
            
        rows = cursor.fetchall()
        history = []
        for r in rows:
            history.append({
                "id": r[0],
                "session_id": r[1],
                "timestamp": r[2],
                "mode": r[3],
                "status": r[4],
                "metric_1": {"name": r[5], "value": r[6]},
                "metric_2": {"name": r[7], "value": r[8]},
                "recommendation": r[9],
                "video_path": r[10]
            })
        return history
    except Exception as e:
        print(f"Error getting history records: {e}")
        return []
    finally:
        if conn:
            conn.close()

def create_doctor_user(name: str, gender: str, age: int, birthday: str, email: str, password_raw: str, specialization: str, medical_license: str, verification_document_blob: bytes) -> bool:
    """Registers a new doctor after hashing their password, setting role='professional' and is_verified=0."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        hashed = hash_password(password_raw)
        cursor.execute("""
            INSERT INTO users (name, gender, age, birthday, email, password, role, specialization, medical_license, verification_document_blob, is_verified)
            VALUES (?, ?, ?, ?, ?, ?, 'professional', ?, ?, ?, 0)
        """, (name, gender, age, birthday, email.lower(), hashed, specialization, medical_license, sqlite3.Binary(verification_document_blob)))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        print(f"Error creating doctor: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_all_users() -> List[Dict[str, Any]]:
    """Retrieves all users from the database."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, gender, age, birthday, email, role, specialization, medical_license, is_verified 
            FROM users
            ORDER BY id DESC
        """)
        rows = cursor.fetchall()
        users = []
        for r in rows:
            user_id = r[0]
            role = r[6] if r[6] else "general user"
            users.append({
                "id": user_id,
                "name": r[1],
                "gender": r[2],
                "age": r[3],
                "birthday": r[4],
                "email": r[5],
                "role": role,
                "specialization": r[7],
                "medical_license": r[8],
                "verification_document": f"/api/admin/view-document/{user_id}" if role == 'professional' else None,
                "is_verified": r[9] if r[9] is not None else 0
            })
        return users
    except Exception as e:
        print(f"Error getting all users: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_doctor_document(user_id: int) -> Optional[bytes]:
    """Retrieves the doctor's uploaded document BLOB by user ID."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("SELECT verification_document_blob FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            return row[0]
        return None
    except Exception as e:
        print(f"Error getting doctor document: {e}")
        return None
    finally:
        if conn:
            conn.close()

def verify_doctor(user_id: int) -> bool:
    """Verifies a doctor account."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users 
            SET is_verified = 1 
            WHERE id = ? AND role = 'professional'
        """, (user_id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error verifying doctor: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_patients() -> List[Dict[str, Any]]:
    """Retrieves all users who are general patients, along with their latest screening info if available."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, gender, age, birthday, email 
            FROM users 
            WHERE role = 'general user'
            ORDER BY name ASC
        """)
        rows = cursor.fetchall()
        
        patients = []
        for r in rows:
            email = r[5]
            # Get latest screening status and timestamp
            cursor.execute("""
                SELECT status, timestamp, mode 
                FROM analysis_history 
                WHERE user_email = ? 
                ORDER BY id DESC LIMIT 1
            """, (email.lower(),))
            latest = cursor.fetchone()
            
            patients.append({
                "id": r[0],
                "name": r[1],
                "gender": r[2],
                "age": r[3],
                "birthday": r[4],
                "email": email,
                "latest_status": latest[0] if latest else "N/A",
                "latest_timestamp": latest[1] if latest else None,
                "latest_mode": latest[2] if latest else "N/A"
            })
        return patients
    except Exception as e:
        print(f"Error getting patients: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_patients_for_doctor(doctor_id: int) -> List[Dict[str, Any]]:
    """Retrieves all patients who have granted permission to this doctor."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT u.id, u.name, u.gender, u.age, u.birthday, u.email, u.is_online
            FROM users u
            WHERE u.role = 'general user' 
            AND (
                EXISTS (SELECT 1 FROM doctor_permissions dp WHERE dp.patient_id = u.id AND dp.doctor_id = ?)
                OR EXISTS (SELECT 1 FROM messages m WHERE (m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id))
                OR EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = u.id AND a.doctor_id = ?)
            )
            ORDER BY u.name ASC
        """, (doctor_id, doctor_id, doctor_id, doctor_id))
        rows = cursor.fetchall()
        
        patients = []
        for r in rows:
            email = r[5]
            cursor.execute("""
                SELECT status, timestamp, mode 
                FROM analysis_history 
                WHERE user_email = ? 
                ORDER BY id DESC LIMIT 1
            """, (email.lower(),))
            latest = cursor.fetchone()
            
            patients.append({
                "id": r[0],
                "name": r[1],
                "gender": r[2],
                "age": r[3],
                "birthday": r[4],
                "email": email,
                "latest_status": latest[0] if latest else "N/A",
                "latest_timestamp": latest[1] if latest else None,
                "latest_mode": latest[2] if latest else "N/A",
                "is_online": r[6]
            })
        return patients
    except Exception as e:
        print(f"Error getting patients for doctor: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_doctors_for_patient(patient_id: int) -> List[Dict[str, Any]]:
    """Retrieves all verified doctors and whether this patient has granted them permission."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.name, u.specialization, u.is_online,
                   CASE WHEN dp.doctor_id IS NOT NULL THEN 1 ELSE 0 END AS has_permission
            FROM users u
            LEFT JOIN doctor_permissions dp ON u.id = dp.doctor_id AND dp.patient_id = ?
            WHERE u.role = 'professional' AND u.is_verified = 1
            ORDER BY u.name ASC
        """, (patient_id,))
        rows = cursor.fetchall()
        
        doctors = []
        for r in rows:
            doctors.append({
                "id": r[0],
                "name": r[1],
                "specialization": r[2],
                "is_online": r[3],
                "has_permission": bool(r[4])
            })
        return doctors
    except Exception as e:
        print(f"Error getting doctors for patient: {e}")
        return []
    finally:
        if conn:
            conn.close()

def check_doctor_permission(patient_id: int, doctor_id: int) -> bool:
    """Checks if a doctor has permission to view a patient's reports."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM doctor_permissions WHERE patient_id = ? AND doctor_id = ?", (patient_id, doctor_id))
        return cursor.fetchone() is not None
    except Exception as e:
        print(f"Error checking permission: {e}")
        return False
    finally:
        if conn:
            conn.close()

def toggle_doctor_permission(patient_id: int, doctor_id: int, grant: bool) -> bool:
    """Grants or revokes a doctor's permission to view a patient's reports."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        if grant:
            cursor.execute("""
                INSERT OR IGNORE INTO doctor_permissions (doctor_id, patient_id)
                VALUES (?, ?)
            """, (doctor_id, patient_id))
        else:
            cursor.execute("""
                DELETE FROM doctor_permissions 
                WHERE doctor_id = ? AND patient_id = ?
            """, (doctor_id, patient_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error toggling permission: {e}")
        return False
    finally:
        if conn:
            conn.close()

def send_message(sender_id: int, receiver_id: int, content: str, file_blob: bytes = None, file_name: str = None, file_type: str = None) -> Dict[str, Any]:
    """Sends a chat message."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        ts = time.time()
        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, content, file_blob, file_name, file_type, timestamp, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        """, (sender_id, receiver_id, content, file_blob, file_name, file_type, ts))
        conn.commit()
        msg_id = cursor.lastrowid
        return {
            "id": msg_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content,
            "file_name": file_name,
            "file_type": file_type,
            "timestamp": ts,
            "is_deleted": 0
        }
    except Exception as e:
        print(f"Error sending message: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_chat_history(user1_id: int, user2_id: int) -> List[Dict[str, Any]]:
    """Retrieves chat history between two users."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, sender_id, receiver_id, content, file_name, file_type, timestamp, is_deleted
            FROM messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp ASC
        """, (user1_id, user2_id, user2_id, user1_id))
        rows = cursor.fetchall()
        
        messages = []
        for r in rows:
            messages.append({
                "id": r[0],
                "sender_id": r[1],
                "receiver_id": r[2],
                "content": r[3] if not r[7] else None,
                "file_name": r[4] if not r[7] else None,
                "file_type": r[5] if not r[7] else None,
                "timestamp": r[6],
                "is_deleted": r[7]
            })
        return messages
    except Exception as e:
        print(f"Error getting chat history: {e}")
        return []
    finally:
        if conn:
            conn.close()

def delete_message(message_id: int, user_id: int) -> bool:
    """Soft deletes a message. Only the sender can delete."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE messages
            SET is_deleted = 1, content = NULL, file_blob = NULL, file_name = NULL, file_type = NULL
            WHERE id = ? AND sender_id = ?
        """, (message_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error deleting message: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_message_file(message_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves file blob from a message."""
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT file_blob, file_name, file_type, is_deleted
            FROM messages
            WHERE id = ?
        """, (message_id,))
        row = cursor.fetchone()
        if row and not row[3] and row[0]: # Not deleted and has blob
            return {
                "blob": row[0],
                "name": row[1],
                "type": row[2]
            }
        return None
    except Exception as e:
        print(f"Error getting message file: {e}")
        return None
    finally:
        if conn:
            conn.close()

def update_doctor_profile(user_id: int, bio: str, clinic_name: str, consultation_hours: str) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET bio = ?, clinic_name = ?, consultation_hours = ?
            WHERE id = ? AND role = 'professional'
        """, (bio, clinic_name, consultation_hours, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error updating doctor profile: {e}")
        return False
    finally:
        if conn:
            conn.close()

def update_user_profile_picture(user_id: int, file_blob: bytes) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET profile_pic_blob = ? WHERE id = ?", (file_blob, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error updating profile picture: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_user_profile_picture(user_id: int) -> Optional[bytes]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("SELECT profile_pic_blob FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if row and row[0]:
            return row[0]
        return None
    except Exception as e:
        print(f"Error getting profile picture: {e}")
        return None
    finally:
        if conn:
            conn.close()

def create_appointment(doctor_id: int, patient_id: int, date: str, time_str: str, notes: str) -> Optional[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        now = time.time()
        cursor.execute("""
            INSERT INTO appointments (doctor_id, patient_id, date, time, status, notes, timestamp)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        """, (doctor_id, patient_id, date, time_str, notes, now))
        
        conn.commit()
        appointment_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        print(f"Error creating appointment: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_appointments_for_doctor(doctor_id: int) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT a.*, u.name as patient_name, u.email as patient_email 
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.doctor_id = ?
            ORDER BY a.date ASC, a.time ASC
        """, (doctor_id,))
        
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting doctor appointments: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_appointments_for_patient(patient_id: int) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT a.*, u.name as doctor_name, u.email as doctor_email 
            FROM appointments a
            JOIN users u ON a.doctor_id = u.id
            WHERE a.patient_id = ?
            ORDER BY a.date ASC, a.time ASC
        """, (patient_id,))
        
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting patient appointments: {e}")
        return []
    finally:
        if conn:
            conn.close()

def update_appointment_status(appointment_id: int, doctor_id: int, status: str) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE appointments
            SET status = ?
            WHERE id = ? AND doctor_id = ?
        """, (status, appointment_id, doctor_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error updating appointment status: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_doctor_schedule(doctor_id: int) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM doctor_schedule WHERE doctor_id = ?", (doctor_id,))
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting schedule: {e}")
        return []
    finally:
        if conn:
            conn.close()

def update_doctor_schedule(doctor_id: int, schedules: List[Dict[str, Any]]) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM doctor_schedule WHERE doctor_id = ?", (doctor_id,))
        for sched in schedules:
            cursor.execute(
                "INSERT INTO doctor_schedule (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)",
                (doctor_id, sched['day_of_week'], sched['start_time'], sched['end_time'])
            )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating schedule: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_schedule_overrides(doctor_id: int) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM schedule_overrides WHERE doctor_id = ? ORDER BY date ASC, start_time ASC", (doctor_id,))
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting overrides: {e}")
        return []
    finally:
        if conn:
            conn.close()

def add_schedule_override(doctor_id: int, date: str, start_time: str, end_time: str, override_type: str, reason: str) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO schedule_overrides (doctor_id, date, start_time, end_time, type, reason) VALUES (?, ?, ?, ?, ?, ?)",
            (doctor_id, date, start_time, end_time, override_type, reason)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adding override: {e}")
        return False
    finally:
        if conn:
            conn.close()

def delete_schedule_override(override_id: int, doctor_id: int) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM schedule_overrides WHERE id = ? AND doctor_id = ?", (override_id, doctor_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error deleting override: {e}")
        return False
    finally:
        if conn:
            conn.close()

def create_notification(user_id: int, title: str, message: str) -> bool:
    conn = None
    import time
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notifications (user_id, title, message, timestamp) VALUES (?, ?, ?, ?)",
            (user_id, title, message, time.time())
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error creating notification: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_notifications(user_id: int) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting notifications: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_unread_message_counts(user_id: int) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT sender_id, COUNT(*) as unread_count 
            FROM messages 
            WHERE receiver_id = ? AND is_read = 0 
            GROUP BY sender_id
        """, (user_id,))
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting unread counts: {e}")
        return []
    finally:
        if conn:
            conn.close()

def mark_messages_read(user_id: int, sender_id: int) -> bool:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE messages 
            SET is_read = 1 
            WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
        """, (user_id, sender_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error marking messages read: {e}")
        return False
    finally:
        if conn:
            conn.close()
