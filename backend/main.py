from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Import split route modules
from routes import auth, analysis, admin, doctor, chat
from database import init_db
from pose_tracker import HAS_MEDIAPIPE

app = FastAPI(
    title="AI-Based Health Condition Detection API",
    description="Modular backend supporting real-time webcam frame processing and offline video file uploads.",
    version="4.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the uploads folder as static files
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "AI-Based Health Condition Detection Service",
        "version": "4.0.0",
        "mediapipe_loaded": HAS_MEDIAPIPE,
        "database": "SQLite Connected"
    }

# Register modular routers
app.include_router(auth.router)
app.include_router(analysis.router)
app.include_router(admin.router)
app.include_router(doctor.router)
app.include_router(chat.router)

# Trigger reload to execute database migrations
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
