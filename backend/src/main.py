import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from src.router.jhcis import jhcis_router
from src.router.queue import queue_router
from src.config.config import get , resource_path

try:
    from src.lib.infosystem import get_system_mac
except Exception:
    def get_system_mac():
        try:
            import uuid
            mac_int = uuid.getnode()
            mac = mac_int.to_bytes(6, "big")
            return ":".join(f"{b:02X}" for b in mac)
        except Exception:
            return "00:00:00:00:00:00"
import json
import urllib.request
import socket
import base64
import sys

SECURE_API = "https://lock-software-api.unknowkubbrother.net"

def validate_token_remote(license_key: str, mac_address: str = None) -> tuple:
    payload = {"license_key": license_key}
    if mac_address:
        payload["mac_address"] = mac_address
    try:
        import requests
        r = requests.post(f"{SECURE_API}/license/validate", json=payload, timeout=10)
        j = r.json() if r.text else {}
        return bool(j.get("valid", False)), j.get("msg") or r.text, r.status_code
    except Exception:
        try:
            req = urllib.request.Request(f"{SECURE_API}/license/validate", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as r:
                body = r.read().decode()
                j = json.loads(body) if body else {}
                return bool(j.get("valid", False)), j.get("msg") or body, r.getcode()
        except Exception as e:
            return False, str(e), None

def image_to_data_uri(path: str, mime_type: str = "image/png") -> str:
    with open(path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"

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

GREEN = "\033[92m"
CYAN = "\033[96m"
RESET = "\033[0m"

try:
    print(f"🌐 IPV4 เครื่อง Server คือ {CYAN}{ip}{RESET}")
except UnicodeEncodeError:
    print(f"IPV4 เครื่อง Server คือ {ip}")

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
        video = get('VIDEO_URL')

        image_conf = get('IMAGE_URL')
        image_val = None
        if image_conf:
            image_conf = str(image_conf)
            if image_conf.startswith('http://') or image_conf.startswith('https://'):
                image_val = image_conf
            else:
                img_path = os.path.join(ASSETS_DIR, image_conf)
                if os.path.exists(img_path):
                    ext = os.path.splitext(img_path)[1].lower()
                    mime = 'image/png'
                    if ext in ('.jpg', '.jpeg'):
                        mime = 'image/jpeg'
                    elif ext == '.webp':
                        mime = 'image/webp'
                    elif ext == '.gif':
                        mime = 'image/gif'
                    try:
                        image_val = image_to_data_uri(img_path, mime)
                    except Exception:
                        image_val = None

        return {
            "HOSPITAL_NAME": get('HOSPITAL_NAME'),
            "VIDEO_URL": video,
            "IMAGE_URL": image_val,
            "LOGO": LogoBase64
        }
    except Exception as e:
        logging.exception("Unhandled error in /api/initial")
        raise HTTPException(status_code=500, detail="Internal server error")

app.include_router(queue_router, prefix="/api/queue")
app.include_router(jhcis_router, prefix="/api/jhcis")

if __name__ == "__main__":
    import uvicorn
    try:
        port = int(os.environ.get('SMARTQ_PORT', '8000'))
    except Exception:
        port = 8000
    try:
        license_key = get('LICENSE_KEY')
    except Exception:
        license_key = None

    try:
        mac_addr = get_system_mac()
    except Exception:
        mac_addr = None

    if not license_key:
        print("\n===============================================================")
        print("SmartQ server will not start: missing LICENSE_KEY in config.")
        print("Please send the machine MAC address below to your administrator to get a license key:")
        print(f"MAC: {mac_addr if mac_addr else 'unknown'}")
        print("Put the received LICENSE_KEY into backend/config/config.json under 'LICENSE_KEY' and restart.")
        print("===============================================================\n")
        sys.exit(1)
    else:
        try:
            is_valid, msg, status = validate_token_remote(license_key, mac_address=mac_addr)
            if not is_valid:
                print("\n===============================================================")
                print("SmartQ server will not start: LICENSE_KEY is invalid or not authorized for this machine.")
                print(f"Server message: {msg}")
                print("If you believe this is an error, contact support with the machine MAC address below:")
                print(f"MAC: {mac_addr if mac_addr else 'unknown'}")
                print("===============================================================\n")
                sys.exit(1)
            else:
                print("License validated — starting server.")
        except Exception as e:
            print(f"License validation error: {e}")
            print("Proceeding cautiously: starting server (validation could not be completed).")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=False
    )
