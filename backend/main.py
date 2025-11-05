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
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await self.broadcast_status()

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

    async def broadcast_status(self):
        await self.broadcast({
            "type": "status",
            "online": len(self.active_connections),
            "queue_length": len(queue),
        })

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
    return HTMLResponse(html)


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

        # ส่งเสียงให้ทุกคน
        await manager.broadcast({"type": "audio", "data": audio_base64})
        await manager.broadcast({"type": "queue_update", "queue": list(queue)})
        await manager.broadcast_status()

        return {"message": "Item dequeued", "item": item}
    return {"message": "Queue is empty"}


# ---------------- WebSocket ----------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "queue_update", "queue": list(queue)})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_status()
