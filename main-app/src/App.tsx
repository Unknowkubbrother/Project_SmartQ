import { useState, useEffect } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { ThaiIDCardData } from "@/interfaces";
import "./App.css";
import Home from "@/pages/Home";
import Footer from "@/components/ui/Footer";
import Main from "@/pages/Main";
import { Progress } from "@/components/ui/progress";

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
        setErrorMessage(null);
        setProgress(13);
        setLoadingMain(true);
      });

      unlistenPhoto = await listen("thai_id_photo", (event) => {
        const payload = event.payload;
        const photoBase64 = payload as string;
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
      const endpoint = url.replace(/\/$/, '') + '/services';
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

  return (
    <main className="w-full h-lvh relative">
      {/* Modal: require backend URL and reader ready before using app */}
      {(!backendConnected || !readerReady) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg p-6 w-[420px]">
            <h2 className="text-lg font-semibold mb-4">ตั้งค่า Backend และตรวจสอบเครื่องอ่านบัตร</h2>
            {!backendConnected ? (
              <div className="space-y-2">
                <label className="text-sm">Backend URL</label>
                <input value={backendInput} onChange={(e) => setBackendInput(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="http://192.168.0.158:8000" />
                <div className="flex items-center gap-2 mt-3">
                  <button className="btn btn-primary" onClick={() => connectBackend(backendInput)} disabled={backendConnecting}>{backendConnecting ? 'กำลังเชื่อม...' : 'เชื่อมต่อ'}</button>
                  <button className="btn" onClick={() => { setBackendInput(''); setBackendError(null); }}>ล้าง</button>
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
      {loadingMain ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <div className="text-lg font-medium">กำลังโหลดข้อมูล...</div>
          <div className="w-[60%]">
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      ) : !cardData ? (
        <Home />
      ) : (
        <Main cardData={cardData} photoData={photoData} onCancel={handleCancel} backendUrl={backendUrl} />
      )}

      <Footer />
    </main>
  );
}

export default App;