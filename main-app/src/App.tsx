import { useState, useEffect } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ThaiIDCardData } from "@/interfaces";
import "./App.css";
import Home from "@/pages/Home";
import Footer from "@/components/ui/Footer";
import Main from "@/pages/Main";
import { Progress } from "@/components/ui/progress";
import { Button } from "./components/ui/button";
import axios from "axios";
import Swal from "sweetalert2";

function App() {
  const [cardData, setCardData] = useState<ThaiIDCardData | null>(null);
  const [incomingData, setIncomingData] = useState<ThaiIDCardData | null>(null);
  const [, setErrorMessage] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);

  const [loadingMain, setLoadingMain] = useState(false);
  const [progress, setProgress] = useState(0);
  // backend URL (session-only) and connection/readiness states
  const [backendInput, setBackendInput] = useState('');
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [backendConnecting, setBackendConnecting] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [readerReady, setReaderReady] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
  let unlistenData: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;
  let unlistenPhoto: UnlistenFn | null = null;
  let unlistenReader: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenData = await listen("thai_id_data", (event) => {
        const payload = event.payload;
        const dataLine = (payload as string).split("\n");
        const dataObj: any = {};
        dataLine.forEach((line) => {
          const [key, value] = line.split(":");
          dataObj[key?.trim()] = value?.trim();
        });

        // don't set cardData immediately — mark incoming and start loader
        setIncomingData(dataObj as ThaiIDCardData);
        // mark reader as ready when we receive data (covers cases where reader-ready event
        // may have been emitted before the frontend listener was registered)
        setReaderReady(true);
        setErrorMessage(null);
        setProgress(13);
        setLoadingMain(true);
      });

      unlistenPhoto = await listen("thai_id_photo", (event) => {
        const payload = event.payload;
        const photoBase64 = payload as string;
        // mark reader as ready when photo arrives
        setReaderReady(true);
        setPhotoData(photoBase64);
      });

      unlistenError = await listen("thai_id_error", (event) => {
        console.error("Error received:", event.payload);
        const payload = event.payload;
        if (typeof payload === "string") {
          setErrorMessage(payload);
          // if reader not found message, mark reader as not ready
          if (payload.includes('ไม่พบเครื่องอ่านบัตร') || payload.includes('ไม่พบ')) {
            setReaderReady(false);
          }
        }
        // cancel any pending load and clear data
        setIncomingData(null);
        setLoadingMain(false);
        setCardData(null);
        setPhotoData(null);
        setProgress(0);
      });

      // listen for reader ready event
      unlistenReader = await listen('thai_reader_ready', (event) => {
        console.debug('Reader ready:', event.payload);
        setReaderReady(true);
        setErrorMessage(null);
      });

      // Probe current reader state in case the backend emitted the ready event before
      // the frontend listener was registered (race). This will set readerReady true
      // if a reader is already present.
      try {
        const current: any = await invoke('check_reader');
        if (current) {
          setReaderReady(true);
          setErrorMessage(null);
        }
      } catch (e) {
        // ignore probe errors
        console.debug('check_reader probe failed', e);
      }
    };

    setupListeners();
    return () => {
      if (unlistenData) unlistenData();
      if (unlistenError) unlistenError();
      if (unlistenPhoto) unlistenPhoto();
      if (unlistenReader) unlistenReader();
    };
  }, []);

  // attempt to connect to backend services
  const connectBackend = async (url: string) => {
    setBackendConnecting(true);
    setBackendError(null);
    try {
      const endpoint = url.replace(/\/$/, '') + '/api'+ '/services';
      const res = await fetch(endpoint, { method: 'GET' });
      if (!res.ok) throw new Error('ไม่สามารถเชื่อมต่อ backend');
      await res.json();
      setBackendUrl(url.replace(/\/$/, ''));
      setBackendConnected(true);
    } catch (e: any) {
      console.error('Backend connect failed', e);
      setBackendError(e?.message || 'connection failed');
      setBackendConnected(false);
    } finally {
      setBackendConnecting(false);
    }
  };

  useEffect(() => {
    if (!loadingMain || !incomingData) return;
    let current = 13;
    setProgress(current);
    const interval = setInterval(() => {
      current = Math.min(100, current + Math.floor(Math.random() * 15) + 5);
      setProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setCardData(incomingData);
          setIncomingData(null);
          setLoadingMain(false);
          setProgress(0);
        }, 250);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [loadingMain, incomingData]);


  const handleCancel = () => {
    setIncomingData(null);
    setCardData(null);
    setPhotoData(null);
    setLoadingMain(false);
    setProgress(0);
    setErrorMessage(null);
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${backendUrl}/api/login`, {
        username,
        password
      });
      if (response.data.user) {
        Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          confirmButtonText: 'ตกลง'
        });
        setIsAuthenticated(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
          confirmButtonText: 'ตกลง'
        });
      }
    } catch (error) {
      console.error('Login failed', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์',
        confirmButtonText: 'ตกลง'
      });
    }
  }

  return (
    <main className="w-full h-lvh relative">
      {/* Modal: require backend URL and reader ready before using app */}
      {(!backendConnected || !readerReady) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg p-6 w-[420px]">
            <h2 className="text-lg font-semibold mb-4">ตั้งค่า Server และตรวจสอบเครื่องอ่านบัตร</h2>
            {!backendConnected ? (
              <div className="space-y-2">
                <label className="text-sm">Server URL</label>
                <input value={backendInput} onChange={(e) => setBackendInput(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="http://192.168.0.158:8000" />
                <div className="flex items-center gap-2 mt-3">
                  <Button className="btn btn-primary" onClick={() => connectBackend(backendInput)} disabled={backendConnecting}>{backendConnecting ? 'กำลังเชื่อม...' : 'เชื่อมต่อ'}</Button>
                  <Button className="btn" onClick={() => { setBackendInput(''); setBackendError(null); }}>ล้าง</Button>
                </div>
                {backendError && <div className="text-sm text-red-600 mt-2">{backendError}</div>}
                <div className="text-sm text-muted-foreground mt-2">ต้องระบุ URL ของ backend ก่อนใช้งาน (ข้อมูลจะไม่ถูกบันทึก)</div>
              </div>
            ) : (
              <div>
                <div className="mb-2">เชื่อมต่อกับ backend: <strong>{backendUrl}</strong></div>
                <div className="mb-3">สถานะเครื่องอ่านบัตร: {readerReady ? (<span className="text-green-600">เชื่อมต่อแล้ว</span>) : (<span className="text-orange-600">ยังไม่เชื่อมต่อ</span>)}</div>
                {!readerReady && <div className="text-sm text-muted-foreground">กรุณาเสียบเครื่องอ่านบัตร รอการเชื่อมต่อ ระบบจะตรวจสอบและเปิดใช้งานเมื่อพบเครื่องอ่าน</div>}
              </div>
            )}
          </div>
        </div>
      )}


      {
        (!isAuthenticated && backendConnected && readerReady) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-lg p-6 w-[400px]">
              <h2 className="text-lg font-semibold mb-4">เข้าสู่ระบบ</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm">ชื่อผู้ใช้</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="text-sm">รหัสผ่าน</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
                </div>
                <div className="flex justify-end">
                  <Button className="btn btn-primary" onClick={() => handleLogin()}>เข้าสู่ระบบ</Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* This is the main application content logic.
        It's now re-ordered to prioritize checking for cardData *after* loading,
        and to ensure Home is only shown when all prerequisites are met.
      */}
      {loadingMain && backendConnected && readerReady && isAuthenticated ? (
        // 1. Show loading screen if we are loading (and all prereqs are met)
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <div className="text-lg font-medium">กำลังโหลดข้อมูล...</div>
          <div className="w-[60%]">
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      ) : cardData ? (
        // 2. If NOT loading, and we HAVE cardData, show Main or an Error
        backendConnected && isAuthenticated && readerReady ? (
          // 2a. All prereqs met: Show Main
          <Main
            cardData={cardData}
            photoData={photoData}
            onCancel={handleCancel}
            backendUrl={backendUrl}
          />
        ) : (
          // 2b. Prereqs failed (e.g., disconnect): Show Warning
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-lg font-semibold">⚠️ ไม่สามารถแสดงข้อมูลได้</div>
            {!backendConnected && <div>❌ การเชื่อมต่อ Backend หลุด</div>}
            {!isAuthenticated && <div>🔒 ออกจากระบบแล้ว</div>}
            {!readerReady && <div>💳 การเชื่อมต่อเครื่องอ่านบัตรหลุด</div>}
            <div className="text-sm text-gray-500 mt-2">กรุณาตรวจสอบและลองอีกครั้ง (อาจจะต้องเริ่มใหม่)</div>
          </div>
        )
      ) : (
        // 3. If NOT loading, and NO cardData...
        backendConnected && isAuthenticated && readerReady ? (
          // 3a. All prereqs met: Show Home (waiting for card)
          <Home />
        ) : (
          // 3b. Prereqs NOT met: Show nothing (null)
          // The modals are handling the UI in this state.
          null
        )
      )}

      <Footer />
    </main>
  );
}

export default App;