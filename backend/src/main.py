import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from src.router.jhcis import jhcis_router
from src.router.queue import queue_router
from src.config.config import get
import socket
import base64

def image_to_data_uri(path: str, mime_type: str = "image/png") -> str:
    with open(path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
        return f"data:{mime_type};base64,{encoded}"
    z
def get_local_ipv4():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

ip = get_local_ipv4()

# สี (ANSI)
GREEN = "\033[92m"
CYAN = "\033[96m"
RESET = "\033[0m"

print(f"🌐 IPV4 เครื่อง Server คือ {CYAN}{ip}{RESET}")

def resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)


ASSETS_DIR = resource_path("assets")
if os.path.exists(ASSETS_DIR):
    print("Assets found:", os.listdir(ASSETS_DIR))
else:
    print("No assets folder found.")


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

app.include_router(queue_router, prefix="/api/queue")
app.include_router(jhcis_router, prefix="/api/jhcis")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False
    )
