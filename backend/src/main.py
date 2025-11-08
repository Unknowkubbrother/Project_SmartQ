from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.router.jhcis import jhcis_router
from src.router.queue import queue_router
from src.router.nhso import nsho_router
from src.config.config import get as config
from src.lib.untils import image_to_data_uri

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
    return {"message": "Welcome to SmartQ Server!"}

@app.get("/api/initial")
def intital():
    LogoBase64 = image_to_data_uri("src/assets/" + config('LOGO_FILE'))
    return {
        "HOSPITAL_NAME" : config('HOSPITAL_NAME'),
        "LOGO": LogoBase64
    }

app.include_router(queue_router, prefix="/api/queue")
app.include_router(jhcis_router, prefix="/api/jhcis")
app.include_router(nsho_router, prefix="/api/nhso")