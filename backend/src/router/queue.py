from collections import deque
from datetime import datetime
from src.models.models import EnqueueItem
from gtts import gTTS
import base64, io
from typing import List
from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from src.config.config import get as config
from zoneinfo import ZoneInfo

queue_router = APIRouter()

operator_registry: dict[str, str] = {}

def get_operator_name(operator_id: str | None) -> str | None:
    if not operator_id:
        return None
    return operator_registry.get(operator_id)

class QueueManager:
    def __init__(self, name: str, counters: List[dict]):
        self.name = name
        self.counters = counters
        self.queue = deque()
        self.active_connections: List[dict] = []
        self.muted = False
        self.history: List[dict] = []
        self.current: dict | None = None
        self.current_audio_base64: str | None = None
        self.counter_number = 0
        self.next_counter_index = 0

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
        history_with_names = []
        for h in self.history:
            h_copy = dict(h)
            cb = h_copy.get("completed_by")
            if cb:
                name = get_operator_name(cb)
                if name:
                    h_copy["completed_by_name"] = name
            history_with_names.append(h_copy)
        await websocket.send_json({"type": "history", "history": history_with_names})
        await websocket.send_json({
            "type": "status",
            "online": len(self.active_connections),
            "queue_length": len(self.queue),
            "processed_count": len(self.history),
            "muted": self.muted,
        })

SERVICES = config("SERVICES")

service_managers: dict[str, QueueManager] = {
    s["name"]: QueueManager(s["name"], s.get("counters", [])) for s in SERVICES
}

@queue_router.get("/services")
def get_services():
    try:
        return SERVICES
    except Exception as e:
        return {"error": str(e)}

@queue_router.post("/{service}/enqueue")
async def enqueue_item(service: str, item: EnqueueItem):
    try:
        manager = service_managers.get(service)
        if not manager:
            return {"error": f"unknown service {service}"}

        manager.counter_number += 1
        counter = getattr(item, "counter", None)
        thailand_tz = ZoneInfo("Asia/Bangkok")
        data = {
            "Q_number": manager.counter_number,
            "FULLNAME_TH": item.FULLNAME_TH,
            "counter": counter,
            "timestamp": datetime.now(thailand_tz).isoformat()
        }
        manager.queue.append(data)
        await manager.broadcast({"type": "queue_update", "queue": list(manager.queue)})
        await manager.broadcast_status()
        return {"message": f"Item enqueued in {service}", "item": data}
    except Exception as e:
        return {"error": str(e)}

@queue_router.post("/{service}/dequeue")
async def dequeue_item(service: str, payload: dict = {}):
    try:
        manager = service_managers.get(service)
        if not manager:
            return {"error": f"unknown service {service}"}

        counter = payload.get("counter")

        if manager.queue:
            item = manager.queue.popleft()
            item["counter"] = counter

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
    except Exception as e:
        return {"error": str(e)}

@queue_router.post("/{service}/complete")
async def complete_item(service: str, payload: dict):
    try:
        manager = service_managers.get(service)
        if not manager:
            return {"error": f"unknown service {service}"}

        try:
            qnum = int(payload.get("Q_number"))
        except Exception:
            return {"error": "missing or invalid Q_number"}

        fullname = payload.get("FULLNAME_TH", "Unknown")
        completed_by = payload.get("completed_by")
        manager.history.insert(0, {"Q_number": qnum, "FULLNAME_TH": fullname, "service": service, "transferred": False, "completed_by": completed_by})
        if len(manager.history) > 50:
            manager.history = manager.history[:50]

        await manager.broadcast({"type": "complete", "Q_number": qnum})
        history_with_names = []
        for h in manager.history:
            h_copy = dict(h)
            cb = h_copy.get("completed_by")
            if cb:
                name = get_operator_name(cb)
                if name:
                    h_copy["completed_by_name"] = name
            history_with_names.append(h_copy)
        await manager.broadcast({"type": "history", "history": history_with_names})
        await manager.broadcast_status()

        if manager.current and manager.current.get("Q_number") == qnum:
            manager.current = None
            manager.current_audio_base64 = None
            await manager.broadcast({"type": "current", "item": None})

        return {"message": "item completed", "Q_number": qnum}
    except Exception as e:
        return {"error": str(e)}

@queue_router.post("/{service}/mute")
async def set_mute(service: str, payload: dict):
    try:
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
    except Exception as e:
        return {"error": str(e)}

@queue_router.post("/{service}/reannounce")
async def reannounce_current(service: str):
    try:
        manager = service_managers.get(service)
        if not manager:
            return {"error": f"unknown service {service}"}
        if not manager.current:
            return {"message": "no current item"}
        if manager.current_audio_base64 and not manager.muted:
            await manager.broadcast({"type": "audio", "data": manager.current_audio_base64}, role="display")
            return {"message": "reannounced"}
        return {"message": "muted or no audio"}
    except Exception as e:
        return {"error": str(e)}

@queue_router.post("/{service}/transfer")
async def transfer_item(service: str, payload: dict):
    try:
        manager = service_managers.get(service)
        if not manager:
            return {"error": f"unknown service {service}"}

        try:
            qnum = int(payload.get("Q_number"))
        except Exception:
            return {"error": "missing or invalid Q_number"}

        target = payload.get("target_service")
        if not target:
            return {"error": "missing target_service"}

        target_manager = service_managers.get(target)
        if not target_manager:
            return {"error": f"unknown target service {target}"}

        found = None
        for h in manager.history:
            if h.get("Q_number") == qnum:
                found = h
                break

        if not found:
            return {"error": "source Q_number not found in history"}

        if found.get("transferred"):
            return {"error": "item already transferred"}

        fullname = found.get("FULLNAME_TH", "Unknown")

        target_manager.counter_number += 1
        thailand_tz = ZoneInfo("Asia/Bangkok")
        new_item = {
            "Q_number": target_manager.counter_number,
            "FULLNAME_TH": fullname,
            "timestamp": datetime.now(thailand_tz).isoformat()
        }
        target_manager.queue.append(new_item)

        found["transferred"] = True
        found["transferred_to"] = target

        await target_manager.broadcast({"type": "queue_update", "queue": list(target_manager.queue)})
        await target_manager.broadcast_status()

        history_with_names = []
        for h in manager.history:
            h_copy = dict(h)
            cb = h_copy.get("completed_by")
            if cb:
                name = get_operator_name(cb)
                if name:
                    h_copy["completed_by_name"] = name
            history_with_names.append(h_copy)
        await manager.broadcast({"type": "history", "history": history_with_names})
        await manager.broadcast_status()

        return {"message": "transferred", "from": {"service": service, "Q_number": qnum}, "to": {"service": target, "Q_number": new_item["Q_number"]}}
    except Exception as e:
        return {"error": str(e)}

@queue_router.websocket("/ws/{service}")
async def websocket_endpoint(websocket: WebSocket, service: str):
    try:
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
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass

@queue_router.post('/operator/register')
async def register_operator(payload: dict):
    try:
        operator_id = payload.get('operatorId')
        name = payload.get('name')
        if not operator_id or not name:
            return {"error": "operatorId and name required"}
        operator_registry[operator_id] = name
        return {"message": "registered", "operatorId": operator_id, "name": name}
    except Exception as e:
        return {"error": str(e)}

@queue_router.get('/operator/{operator_id}')
def get_operator(operator_id: str):
    try:
        return {"operatorId": operator_id, "name": operator_registry.get(operator_id)}
    except Exception as e:
        return {"error": str(e)}
