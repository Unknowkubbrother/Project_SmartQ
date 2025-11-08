from collections import deque
from src.models.models import EnqueueItem
from gtts import gTTS
import base64, io
from typing import List
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import APIRouter

queue_inspect_router = APIRouter()

inspect_currentQ_number = 0
inspect_queue = deque()

class InspectConnectionManager:
    def __init__(self):
        self.active_connections: List[dict] = []
        self.muted: bool = False
        self.history: List[dict] = []
        self.current: dict | None = None
        self.current_audio_base64: str | None = None

    async def connect(self, websocket: WebSocket, role: str = 'client'):
        await websocket.accept()
        self.active_connections.append({ 'ws': websocket, 'role': role })
        await self.send_initial_state(websocket)
        await self.broadcast_status()

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [c for c in self.active_connections if c['ws'] != websocket]

    async def broadcast(self, message: dict, role: str | None = None):
        for connection in list(self.active_connections):
            try:
                if role and connection.get('role') != role:
                    continue
                await connection['ws'].send_json(message)
            except Exception:
                try:
                    connection['ws'].close()
                except Exception:
                    pass
                self.disconnect(connection['ws'])

    async def broadcast_status(self):
        await self.broadcast({
            "type": "status",
            "online": len(self.active_connections),
            "queue_length": len(inspect_queue),
            "processed_count": len(self.history),
            "muted": self.muted,
        })

    async def send_initial_state(self, websocket: WebSocket):
        try:
            await websocket.send_json({"type": "queue_update", "queue": list(inspect_queue)})
            await websocket.send_json({"type": "current", "item": self.current})
            await websocket.send_json({"type": "history", "history": self.history})
            await websocket.send_json({"type": "status", "online": len(self.active_connections), "queue_length": len(inspect_queue), "processed_count": len(self.history), "muted": self.muted})
        except Exception:
            pass

manager = InspectConnectionManager()

serviceTypes = {
    "general": "ช่องบริการทั่วไป",
    "appointment": "ช่องบริการนัดหมาย",
    "emergency": "ช่องบริการฉุกเฉิน",
    "other": "ช่องบริการอื่นๆ",
    "contact_staff": "ติดต่อเจ้าหน้าที่"
  };

@queue_inspect_router.get('/services')
def get_services():
    return serviceTypes

@queue_inspect_router.post("/enqueue")
async def enqueue_item(item: EnqueueItem):
    global inspect_currentQ_number
    inspect_currentQ_number += 1
    data = {"Q_number": inspect_currentQ_number, "FULLNAME_TH": item.FULLNAME_TH}
    inspect_queue.append(data)
    await manager.broadcast({"type": "queue_update", "queue": list(inspect_queue)})
    await manager.broadcast_status()
    return {"message": "Item enqueued", "item": data}


@queue_inspect_router.post("/dequeue")
async def dequeue_item():
    if manager.current:
        prev = manager.current
        manager.history.insert(0, {"Q_number": prev['Q_number'], "FULLNAME_TH": prev['FULLNAME_TH'], "service": prev.get('service', '')})
        if len(manager.history) > 50:
            manager.history = manager.history[:50]
        await manager.broadcast({"type": "complete", "Q_number": prev['Q_number']})
    if inspect_queue:
        item = inspect_queue.popleft()
        text = f"คิวหมายเลข {item['Q_number']} {item['FULLNAME_TH']} กรุณารอที่ {item['service']}"
        tts = gTTS(text=text, lang="th")
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_base64 = base64.b64encode(fp.read()).decode("utf-8")

        manager.current = item
        manager.current_audio_base64 = audio_base64

        if not manager.muted:
            await manager.broadcast({"type": "audio", "data": audio_base64}, role='display')

        await manager.broadcast({"type": "current", "item": item})
        await manager.broadcast({"type": "queue_update", "queue": list(inspect_queue)})
        await manager.broadcast_status()

        return {"message": "Item dequeued", "item": item}

    manager.current = None
    manager.current_audio_base64 = None
    await manager.broadcast({"type": "current", "item": None})
    await manager.broadcast_status()
    return {"message": "Queue is empty"}


@queue_inspect_router.post("/mute")
async def set_mute(payload: dict):
    try:
        muted = bool(payload.get('muted', True))
    except Exception:
        muted = True
    manager.muted = muted
    await manager.broadcast_status()
    return {"message": "mute updated", "muted": manager.muted}


@queue_inspect_router.post('/reannounce')
async def reannounce_current():
    if not manager.current:
        return {"message": "no current item"}
    if manager.current_audio_base64 and not manager.muted:
        await manager.broadcast({"type": "audio", "data": manager.current_audio_base64}, role='display')
        return {"message": "reannounced"}
    return {"message": "muted or no audio"}


@queue_inspect_router.post("/complete")
async def complete_item(payload: dict):
    try:
        qnum = int(payload.get('Q_number'))
    except Exception:
        return {"error": "missing or invalid Q_number"}

    fullname = payload.get('FULLNAME_TH', 'Unknown')
    service = payload.get('service', '')

    manager.history.insert(0, {"Q_number": qnum, "FULLNAME_TH": fullname, "service": service})
    if len(manager.history) > 50:
        manager.history = manager.history[:50]

    await manager.broadcast({"type": "complete", "Q_number": qnum})
    await manager.broadcast({"type": "history", "history": manager.history})
    await manager.broadcast_status()

    if manager.current and manager.current.get('Q_number') == qnum:
        manager.current = None
        manager.current_audio_base64 = None
        await manager.broadcast({"type": "current", "item": None})

    return {"message": "item completed", "Q_number": qnum}


@queue_inspect_router.websocket("/ws_inspect")
async def websocket_endpoint(websocket: WebSocket):
    role = websocket.query_params.get('role', 'client')
    await manager.connect(websocket, role=role)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_status()
