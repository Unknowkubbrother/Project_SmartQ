import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from src.router.jhcis import jhcis_router
from src.router.queue import queue_router
from src.router.nhso import nsho_router
from src.config.config import get
from src.lib.untils import image_to_data_uri

# resource_path สำหรับ assets
def resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)  # path EXE
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))  # path .py
    return os.path.join(base_path, relative_path)

# assets directory
ASSETS_DIR = resource_path("assets")
if os.path.exists(ASSETS_DIR):
    print("Assets found:", os.listdir(ASSETS_DIR))
else:
    print("No assets folder found.")

# FastAPI app
app = FastAPI(title="SmartQ Voice Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def server():
    try:
        return {"message": "Welcome to SmartQ Server!"}
    except Exception as e:
        logging.exception("Unhandled error in root endpoint")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/initial")
def initial():
    try:
        logo_path = os.path.join(ASSETS_DIR, get('LOGO_FILE'))
        LogoBase64 = image_to_data_uri(logo_path)
        return {
            "HOSPITAL_NAME": get('HOSPITAL_NAME'),
            "LOGO": LogoBase64
        }
    except Exception as e:
        logging.exception("Unhandled error in /api/initial")
        raise HTTPException(status_code=500, detail="Internal server error")

# include routers
app.include_router(queue_router, prefix="/api/queue")
app.include_router(jhcis_router, prefix="/api/jhcis")
app.include_router(nsho_router, prefix="/api/nhso")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,              # ใช้ตัว app object โดยตรง
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False      # ไม่ใช้ reload บน EXE
    )
