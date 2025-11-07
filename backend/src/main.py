from fastapi import FastAPI , Response, status
from fastapi.middleware.cors import CORSMiddleware
from src.router.jhcis import jhcis_router
from src.router.queue_inspect import queue_inspect_router
from src.router.queue_gmdc import queue_gmdc_router
from src.router.nhso import nsho_router

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
    return {"message": "Welcome to SmartQ Server!"}

app.include_router(queue_inspect_router, prefix="/api/inspect")
app.include_router(queue_gmdc_router, prefix="/api/gmdc")
app.include_router(jhcis_router, prefix="/api/jhcis")
app.include_router(nsho_router, prefix="/api/nhso")