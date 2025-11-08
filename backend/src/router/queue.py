from collections import deque
from src.models.models import EnqueueItem
from gtts import gTTS
import base64, io
from typing import List
from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from src.config.config import get as config

queue_router = APIRouter()


class QueueManager:
    def __init__(self, name: str, counters: List[dict]):
        self.name = name
        self.counters = counters  # list of counters for this service
        self.queue = deque()
        self.active_connections: List[dict] = []
        self.muted = False
        self.history: List[dict] = []
        self.current: dict | None = None
        self.current_audio_base64: str | None = None
        self.counter_number = 0
        self.next_counter_index = 0  # สำหรับสลับช่อง

    async def connect(self, websocket: WebSocket, role: str = "client"):
        await websocket.accept()
        self.active_connections.append({"ws": websocket, "role": role})
        await self.send_initial_state(websocket)
        await self.broadcast_status()

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [c for c in self.active_connections if c["ws"] != websocket]

    async def broadcast(self, message: dict, role: str | None = None):
        for conn in list(self.active_connections):
            try:
                if role and conn.get("role") != role:
                    continue
                await conn["ws"].send_json(message)
            except Exception:
                try:
                    conn["ws"].close()
                except Exception:
                    pass
                self.disconnect(conn["ws"])

    async def broadcast_status(self):
        await self.broadcast({
            "type": "status",
            "online": len(self.active_connections),
            "queue_length": len(self.queue),
            "processed_count": len(self.history),
            "muted": self.muted,
        })

    async def send_initial_state(self, websocket: WebSocket):
        await websocket.send_json({"type": "queue_update", "queue": list(self.queue)})
        await websocket.send_json({"type": "current", "item": self.current})
        await websocket.send_json({"type": "history", "history": self.history})
        await websocket.send_json({
            "type": "status",
            "online": len(self.active_connections),
            "queue_length": len(self.queue),
            "processed_count": len(self.history),
            "muted": self.muted,
        })


# === services config ===
SERVICES = config("SERVICES")

# === สร้าง manager แยกแต่ละ service ===
service_managers: dict[str, QueueManager] = {
    s["name"]: QueueManager(s["name"], s.get("counters", [])) for s in SERVICES
}


@queue_router.get("/services")
def get_services():
    return SERVICES

@queue_router.post("/{service}/enqueue")
async def enqueue_item(service: str, item: EnqueueItem):
    manager = service_managers.get(service)
    if not manager:
        return {"error": f"unknown service {service}"}

    manager.counter_number += 1
    # ถ้า client ส่ง counter มาให้บันทึกด้วย
    counter = getattr(item, "counter", None)

    data = {
        "Q_number": manager.counter_number,
        "FULLNAME_TH": item.FULLNAME_TH,
        "counter": counter,
    }
    manager.queue.append(data)
    await manager.broadcast({"type": "queue_update", "queue": list(manager.queue)})
    await manager.broadcast_status()
    return {"message": f"Item enqueued in {service}", "item": data}


@queue_router.post("/{service}/dequeue")
async def dequeue_item(service: str, payload: dict = {}):
    manager = service_managers.get(service)
    if not manager:
        return {"error": f"unknown service {service}"}

    # เลือก counter จาก payload
    counter = payload.get("counter")

    if manager.current:
        prev = manager.current
        manager.history.insert(0, prev)
        if len(manager.history) > 50:
            manager.history = manager.history[:50]
        await manager.broadcast({"type": "complete", "Q_number": prev["Q_number"]})

    if manager.queue:
        item = manager.queue.popleft()
        item["counter"] = counter  # เพิ่ม counter ลงใน current

        text = f"คิวหมายเลข {item['Q_number']} {item['FULLNAME_TH']} กรุณาไปที่ {counter or 'ช่องบริการ'}"
        tts = gTTS(text=text, lang="th")
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_base64 = base64.b64encode(fp.read()).decode("utf-8")

        manager.current = item
        manager.current_audio_base64 = audio_base64

        if not manager.muted:
            await manager.broadcast({"type": "audio", "data": audio_base64}, role="display")

        await manager.broadcast({"type": "current", "item": item})
        await manager.broadcast({"type": "queue_update", "queue": list(manager.queue)})
        await manager.broadcast_status()

        return {"message": "Item dequeued", "item": item}

    manager.current = None
    manager.current_audio_base64 = None
    await manager.broadcast({"type": "current", "item": None})
    await manager.broadcast_status()
    return {"message": "Queue is empty"}


@queue_router.post("/{service}/complete")
async def complete_item(service: str, payload: dict):
    manager = service_managers.get(service)
    if not manager:
        return {"error": f"unknown service {service}"}

    try:
        qnum = int(payload.get("Q_number"))
    except Exception:
        return {"error": "missing or invalid Q_number"}

    fullname = payload.get("FULLNAME_TH", "Unknown")

    # ใช้ service จาก URL
    manager.history.insert(0, {"Q_number": qnum, "FULLNAME_TH": fullname, "service": service})
    if len(manager.history) > 50:
        manager.history = manager.history[:50]

    await manager.broadcast({"type": "complete", "Q_number": qnum})
    await manager.broadcast({"type": "history", "history": manager.history})
    await manager.broadcast_status()

    if manager.current and manager.current.get("Q_number") == qnum:
        manager.current = None
        manager.current_audio_base64 = None
        await manager.broadcast({"type": "current", "item": None})

    return {"message": "item completed", "Q_number": qnum}


@queue_router.post("/{service}/mute")
async def set_mute(service: str, payload: dict):
    manager = service_managers.get(service)
    if not manager:
        return {"error": f"unknown service {service}"}
    try:
        muted = bool(payload.get("muted", True))
    except Exception:
        muted = True
    manager.muted = muted
    await manager.broadcast_status()
    return {"message": "mute updated", "muted": manager.muted}


@queue_router.post("/{service}/reannounce")
async def reannounce_current(service: str):
    manager = service_managers.get(service)
    if not manager:
        return {"error": f"unknown service {service}"}
    if not manager.current:
        return {"message": "no current item"}
    if manager.current_audio_base64 and not manager.muted:
        await manager.broadcast({"type": "audio", "data": manager.current_audio_base64}, role="display")
        return {"message": "reannounced"}
    return {"message": "muted or no audio"}


@queue_router.websocket("/ws/{service}")
async def websocket_endpoint(websocket: WebSocket, service: str):
    manager = service_managers.get(service)
    if not manager:
        await websocket.close()
        return

    role = websocket.query_params.get("role", "client")
    await manager.connect(websocket, role=role)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_status()
