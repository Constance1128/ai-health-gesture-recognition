from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body
from fastapi.responses import Response
from typing import List, Dict, Any, Optional
import os

from database import (
    get_user_by_email,
    get_chat_history,
    send_message,
    delete_message,
    get_message_file,
    get_unread_message_counts,
    mark_messages_read
)

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB

@router.get("/history")
def chat_history(email: str, other_user_id: int):
    """Fetches chat log between the current user and another user."""
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    messages = get_chat_history(user["id"], other_user_id)
    return messages

@router.post("/send")
async def chat_send(
    email: str = Form(...),
    receiver_id: int = Form(...),
    content: str = Form(""),
    file: Optional[UploadFile] = File(None)
):
    """Sends a message, optionally with a file attachment (max 5MB)."""
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    file_blob = None
    file_name = None
    file_type = None
    
    if file:
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit. Please upload a smaller file.")
        
        file_blob = file_bytes
        file_name = file.filename
        file_type = file.content_type
        
    if not content and not file_blob:
        raise HTTPException(status_code=400, detail="Message content or file is required.")
        
    msg = send_message(
        sender_id=user["id"],
        receiver_id=receiver_id,
        content=content,
        file_blob=file_blob,
        file_name=file_name,
        file_type=file_type
    )
    
    if not msg:
        raise HTTPException(status_code=500, detail="Failed to send message.")
        
    return msg

@router.post("/delete")
def chat_delete(email: str = Form(...), message_id: int = Form(...)):
    """Deletes a message."""
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    success = delete_message(message_id, user["id"])
    if not success:
        raise HTTPException(status_code=400, detail="Could not delete message. Either it does not exist or you are not the sender.")
        
    return {"message": "Message deleted successfully."}

@router.get("/file/{message_id}")
def chat_file(message_id: int):
    """Serves an uploaded chat file."""
    file_data = get_message_file(message_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=file_data["blob"], media_type=file_data["type"])

@router.get("/unread-counts")
def chat_unread_counts(email: str):
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return get_unread_message_counts(user["id"])

@router.post("/mark-read")
def chat_mark_read(payload: Dict[str, Any] = Body(...)):
    email = payload.get("email")
    sender_id = payload.get("sender_id")
    
    if not email or not sender_id:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    success = mark_messages_read(user["id"], sender_id)
    return {"success": success}
