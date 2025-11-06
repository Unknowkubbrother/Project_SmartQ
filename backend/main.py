from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from gtts import gTTS
import base64, io
from typing import List

class EnqueueItem(BaseModel):
    FULLNAME_TH: str
    service: str

app = FastAPI(title="SmartQ Voice Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

currentQ_number = 0
queue = deque()


# ---------------- Connection Manager ----------------
class ConnectionManager:
    def __init__(self):
        # store tuples of (websocket, role)
        self.active_connections: List[dict] = []
        self.muted: bool = False
        self.history: List[dict] = []

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

# ---------------- HTML for Test ----------------
html = """
<!DOCTYPE html>
<html>
<head><title>SmartQ Voice</title></head>
<body>
  <h2>🔊 Smart Queue System with Voice</h2>
  <p id="status">Connecting...</p>
  <ul id="queue"></ul>
  <input id="fullname" placeholder="ชื่อผู้ใช้..." />
  <button onclick="enqueue()">เพิ่มคิว</button>
  <button onclick="dequeue()">เรียกคิวถัดไป</button>

  <script>
    const ws = new WebSocket("ws://192.168.0.158:8000/ws");

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "status") {
            document.getElementById("status").textContent =
                `🟢 Online: ${msg.online} | Queue: ${msg.queue_length}`;
        } else if (msg.type === "queue_update") {
            const list = document.getElementById("queue");
            list.innerHTML = "";
            msg.queue.forEach(q => {
                const li = document.createElement("li");
                li.textContent = `${q.Q_number} - ${q.FULLNAME_TH} (${q.service})`;
                list.appendChild(li);
            });
        } else if (msg.type === "audio") {
            const audioBlob = await fetch(`data:audio/mp3;base64,${msg.data}`).then(res => res.blob());
            const audio = new Audio(URL.createObjectURL(audioBlob));
            audio.play();
        }
    };

    async function enqueue() {
        const name = document.getElementById("fullname").value;
        await fetch("/enqueue", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ FULLNAME_TH: name })
        });
    }

    async function dequeue() {
        await fetch("/dequeue", { method: "POST" });
    }
  </script>
</body>
</html>
"""

@app.get("/")
def index():
    return {"message": "SmartQ Voice Backend is running."}
    # return HTMLResponse(html)


@app.get('/services')
def get_services():
    # return mapping of service key to label
    return serviceTypes


# ---------------- Queue Functions ----------------
@app.post("/enqueue")
async def enqueue_item(item: EnqueueItem):
    global currentQ_number
    currentQ_number += 1
    data = {"Q_number": currentQ_number, "FULLNAME_TH": item.FULLNAME_TH , "service": serviceTypes[item.service]}
    queue.append(data)
    await manager.broadcast({"type": "queue_update", "queue": list(queue)})
    await manager.broadcast_status()
    return {"message": "Item enqueued", "item": data}


@app.post("/dequeue")
async def dequeue_item():
    if queue:
        item = queue.popleft()
        text = f"คิวหมายเลข {item['Q_number']} {item['FULLNAME_TH']} กรุณารอที่ {item['service']}"
        tts = gTTS(text=text, lang="th")
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_base64 = base64.b64encode(fp.read()).decode("utf-8")
        # Prepare audio and send to displays (if not muted)
        if not manager.muted:
            await manager.broadcast({"type": "audio", "data": audio_base64}, role='display')

        # send current item to everyone (so callers can show calling state)
        await manager.broadcast({"type": "current", "item": item})

        # broadcast queue update (history is not updated until item is completed)
        await manager.broadcast({"type": "queue_update", "queue": list(queue)})
        await manager.broadcast_status()

        return {"message": "Item dequeued", "item": item}
    return {"message": "Queue is empty"}


@app.post("/mute")
async def set_mute(payload: dict):
    # payload: { muted: bool }
    try:
        muted = bool(payload.get('muted', True))
    except Exception:
        muted = True
    manager.muted = muted
    await manager.broadcast_status()
    return {"message": "mute updated", "muted": manager.muted}


@app.post("/complete")
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

    return {"message": "item completed", "Q_number": qnum}


# ---------------- WebSocket ----------------
@app.websocket("/ws")
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
