
from collections import deque
from src.models import EnqueueItem
from gtts import gTTS
import base64, io
from typing import List
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import APIRouter

queue_router = APIRouter()

currentQ_number = 0
queue = deque()

# ---------------- Connection Manager ----------------
class ConnectionManager:
    def __init__(self):
        # store tuples of (websocket, role)
        self.active_connections: List[dict] = []
        self.muted: bool = False
        self.history: List[dict] = []
        # currently calling item and its pre-generated audio (base64)
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
        # if role is provided, only send to connections with that role
        for connection in list(self.active_connections):
            try:
                if role and connection.get('role') != role:
                    continue
                await connection['ws'].send_json(message)
            except Exception:
                # ignore send errors and remove connection
                try:
                    connection['ws'].close()
                except Exception:
                    pass
                self.disconnect(connection['ws'])

    async def broadcast_status(self):
        await self.broadcast({
            "type": "status",
            "online": len(self.active_connections),
            "queue_length": len(queue),
            "processed_count": len(self.history),
            "muted": self.muted,
        })

    async def send_initial_state(self, websocket: WebSocket):
        # send queue_update, status and history to a single websocket
        try:
            await websocket.send_json({"type": "queue_update", "queue": list(queue)})
            # send current item if exists
            await websocket.send_json({"type": "current", "item": self.current})
            await websocket.send_json({"type": "history", "history": self.history})
            await websocket.send_json({"type": "status", "online": len(self.active_connections), "queue_length": len(queue), "processed_count": len(self.history), "muted": self.muted})
        except Exception:
            pass

manager = ConnectionManager()

serviceTypes = {
    "general": "ช่องบริการทั่วไป",
    "appointment": "ช่องบริการนัดหมาย",
    "emergency": "ช่องบริการฉุกเฉิน",
    "other": "ช่องบริการอื่นๆ",
    "contact_staff": "ติดต่อเจ้าหน้าที่"
  };

@queue_router.get('/services')
def get_services():
    # return mapping of service key to label
    return serviceTypes


# ---------------- Queue Functions ----------------
@queue_router.post("/enqueue")
async def enqueue_item(item: EnqueueItem):
    global currentQ_number
    currentQ_number += 1
    data = {"Q_number": currentQ_number, "FULLNAME_TH": item.FULLNAME_TH , "service": serviceTypes["general"]}
    queue.append(data)
    await manager.broadcast({"type": "queue_update", "queue": list(queue)})
    await manager.broadcast_status()
    return {"message": "Item enqueued", "item": data}


@queue_router.post("/dequeue")
async def dequeue_item():
    # Auto-complete previous current if exists
    if manager.current:
        prev = manager.current
        manager.history.insert(0, {"Q_number": prev['Q_number'], "FULLNAME_TH": prev['FULLNAME_TH'], "service": prev.get('service', '')})
        if len(manager.history) > 50:
            manager.history = manager.history[:50]
        await manager.broadcast({"type": "complete", "Q_number": prev['Q_number']})

    if queue:
        item = queue.popleft()
        text = f"คิวหมายเลข {item['Q_number']} {item['FULLNAME_TH']} กรุณารอที่ {item['service']}"
        tts = gTTS(text=text, lang="th")
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_base64 = base64.b64encode(fp.read()).decode("utf-8")

        # store current and its audio so we can re-announce later
        manager.current = item
        manager.current_audio_base64 = audio_base64

        # send audio to displays (if not muted)
        if not manager.muted:
            await manager.broadcast({"type": "audio", "data": audio_base64}, role='display')

        # send current item to everyone (so callers can show calling state)
        await manager.broadcast({"type": "current", "item": item})

        # broadcast queue update
        await manager.broadcast({"type": "queue_update", "queue": list(queue)})
        await manager.broadcast_status()

        return {"message": "Item dequeued", "item": item}

    # if no item to dequeue, ensure current cleared and notify
    manager.current = None
    manager.current_audio_base64 = None
    await manager.broadcast({"type": "current", "item": None})
    await manager.broadcast_status()
    return {"message": "Queue is empty"}


@queue_router.post("/mute")
async def set_mute(payload: dict):
    # payload: { muted: bool }
    try:
        muted = bool(payload.get('muted', True))
    except Exception:
        muted = True
    manager.muted = muted
    await manager.broadcast_status()
    return {"message": "mute updated", "muted": manager.muted}


@queue_router.post('/reannounce')
async def reannounce_current():
    # Re-send the current audio to display clients
    if not manager.current:
        return {"message": "no current item"}
    if manager.current_audio_base64 and not manager.muted:
        await manager.broadcast({"type": "audio", "data": manager.current_audio_base64}, role='display')
        return {"message": "reannounced"}
    return {"message": "muted or no audio"}


@queue_router.post("/complete")
async def complete_item(payload: dict):
    # Expected payload: { "Q_number": int, "FULLNAME_TH": str, "service": str }
    try:
        qnum = int(payload.get('Q_number'))
    except Exception:
        return {"error": "missing or invalid Q_number"}

    fullname = payload.get('FULLNAME_TH', 'Unknown')
    service = payload.get('service', '')

    # add to history as completed
    manager.history.insert(0, {"Q_number": qnum, "FULLNAME_TH": fullname, "service": service})
    if len(manager.history) > 50:
        manager.history = manager.history[:50]

    # notify clients about completion and updated history/status
    await manager.broadcast({"type": "complete", "Q_number": qnum})
    await manager.broadcast({"type": "history", "history": manager.history})
    await manager.broadcast_status()

    # if the completed item was the current one, clear current and notify
    if manager.current and manager.current.get('Q_number') == qnum:
        manager.current = None
        manager.current_audio_base64 = None
        await manager.broadcast({"type": "current", "item": None})

    return {"message": "item completed", "Q_number": qnum}


# ---------------- WebSocket ----------------
@queue_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # read role from query params
    role = websocket.query_params.get('role', 'client')
    await manager.connect(websocket, role=role)
    try:
        while True:
            # We don't expect messages from clients in this simple protocol, just keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_status()
