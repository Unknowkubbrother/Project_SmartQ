from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.router.jhcis import jhcis_router
from src.router.queue import queue_router

app = FastAPI(title="SmartQ Voice Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartQ Voice Backend!"}

app.include_router(queue_router, prefix="/api")
app.include_router(jhcis_router, prefix="/api")