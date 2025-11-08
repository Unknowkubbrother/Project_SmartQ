import { useState, useEffect,useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { SmartQPayload , ThaiIDCardData } from "@/interfaces";
import "./App.css";
import Home from "@/pages/Home";
// import Footer from "@/components/ui/Footer";
import Main from "@/pages/Main";
import { Progress } from "@/components/ui/progress";
import { Button } from "./components/ui/button";
import axios from "axios";
import Swal from "sweetalert2";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


function App() {
    useEffect(() => {
    // ป้องกันคลิกขวา
    const handleContextMenu = (e : any) => {
      e.preventDefault();
      alert('คลิกขวาถูกปิดใช้งาน!');
    };

    // ป้องกัน Ctrl+C, Ctrl+U, Ctrl+Shift+I
    const handleKeyDown = (e : any) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 's')) {
        e.preventDefault();
        alert('ไม่สามารถคัดลอกหรือดู source ได้!');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        alert('ไม่อนุญาต DevTools!');
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // ลบ event listener ตอน component ถูก unmount
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [cardData, setCardData] = useState<SmartQPayload | null>(null);
  const [incomingData, setIncomingData] = useState<SmartQPayload | null>(null);
  const [, setErrorMessage] = useState<string | null>(null);
  const [loadingMain, setLoadingMain] = useState(false);
  const [progress, setProgress] = useState(0);

  const [backendInput, setBackendInput] = useState('');
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const backendUrlRef = useRef<string | null>(null);
  const [backendConnecting, setBackendConnecting] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [readerReady, setReaderReady] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [listusernames, setListUsernames] = useState<string[]>([]);

  const [HOSPITAL_NAME, setHOSPITAL_NAME] = useState<string>('');
  const [LOGO, setLOGO] = useState<string>('');

  const inital = async (base : string) => {
        const response = await axios.get(`${base}/api/initial`);
        setHOSPITAL_NAME(response.data.HOSPITAL_NAME);
        setLOGO(response.data.LOGO);
    };


  const fetchUsernames = async (backendUrl : string) => {
    try {
      const response = await axios.get(`${backendUrl}/api/jhcis/usernames`);
      setListUsernames(response.data);
    } catch (error) {
      console.error('Error fetching usernames:', error);
    }
  };

  useEffect(() => {
    let unlistenThaiidData: UnlistenFn | null = null;
    let unlistenError: UnlistenFn | null = null;
    let unlistenReader: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenThaiidData = await listen("thai_id_data", async (event) => {
        const payload = event.payload;
        const dataLine = (payload as string).split("\n");
        const dataObj: any = {};
        dataLine.forEach((line) => {
          const [key, value] = line.split(":");
          dataObj[key?.trim()] = value?.trim();
        });


        // Process the incoming data
        const res = await axios.get(`${backendUrlRef.current}/api/nhso/smartcard_read`, { params: { readImageFlag: true } });

        if (res.status !== 200) {
          throw new Error("ไม่สามารถอ่านบัตรประชาชนได้");
        }

        const personalObj = {
          ...res.data.data as SmartQPayload,
          thaiIDCardData: dataObj as ThaiIDCardData
        }
        setIncomingData(personalObj);
        setReaderReady(true);
        setErrorMessage(null);
        setProgress(13);
        setLoadingMain(true);
      });

      unlistenError = await listen("thai_id_error", (event) => {
        console.error("Error received:", event.payload);
        const payload = event.payload;
        if (typeof payload === "string") {
          setErrorMessage(payload);
          if (payload.includes('ไม่พบเครื่องอ่านบัตร') || payload.includes('ไม่พบ')) {
            setReaderReady(false);
          }
        }

        setIncomingData(null);
        setLoadingMain(false);
        setCardData(null);
        setProgress(0);
      });

      unlistenReader = await listen('thai_reader_ready', async (event) => {
        console.debug('Reader ready:', event.payload);
        setReaderReady(true);
        setErrorMessage(null);
      });

      try {
        const current: any = await invoke('check_reader');
        if (current) {
          setReaderReady(true);
          setErrorMessage(null);
        }
      } catch (e) {
        console.debug('check_reader probe failed', e);
      }
    };

    setupListeners();
    return () => {
      if (unlistenThaiidData) unlistenThaiidData();
      if (unlistenError) unlistenError();
      if (unlistenReader) unlistenReader();
    };
  }, []);

  const connectBackend = async (url: string) => {
    setBackendConnecting(true);
    setBackendError(null);
    try {
      const base = url.replace(/\/$/, "");
      const res = await axios.get(base);

      if (res.status !== 200) {
        throw new Error("ไม่สามารถเชื่อมต่อ backend");
      }
      
      setBackendUrl(base);
      backendUrlRef.current = base;
      setBackendConnected(true);
      fetchUsernames(base);
      inital(base);
    } catch (e: any) {
      console.error("Backend connect failed", e);
      const message =
        e?.response?.data?.message || e?.message || "connection failed";
      setBackendError(message);
      setBackendConnected(false);
      setListUsernames([]);
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
    setLoadingMain(false);
    setProgress(0);
    setErrorMessage(null);
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${backendUrl}/api/jhcis/login`, {
        username,
        password
      });

      if (response.status !== 200) {
        Swal.fire({
          icon: 'error',
          title: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
          confirmButtonText: 'ตกลง'
        });
        return;
      }
      
     Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          confirmButtonText: 'ตกลง'
        });
      setIsAuthenticated(true);
      
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
      {(!backendConnected || !readerReady) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg p-6 w-[420px]">
            <h2 className="text-lg font-semibold mb-4">ตั้งค่า Server และตรวจสอบเครื่องอ่านบัตร</h2>
            {!backendConnected ? (
              <div className="space-y-2">
                <label className="text-sm">Server URL</label>
                <input value={backendInput} onChange={(e) => setBackendInput(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="http://192.168.0.158:8000" />
                <div className="flex items-center gap-2 mt-3">
                  <Button className="btn btn-primary bg-emerald-500 hover:bg-emerald-600" onClick={() => connectBackend(backendInput)} disabled={backendConnecting}>{backendConnecting ? 'กำลังเชื่อม...' : 'เชื่อมต่อ'}</Button>
                  <Button className="btn bg-rose-400 hover:bg-rose-500" onClick={() => { setBackendInput(''); setBackendError(null); }}>ล้าง</Button>
                </div>
                {backendError && <div className="text-sm text-red-600 mt-2">{backendError}</div>}
                <div className="text-sm text-muted-foreground mt-2">ต้องระบุ URL ของ server ก่อนใช้งาน (ข้อมูลจะไม่ถูกบันทึก)</div>
              </div>
            ) : (
              <div>
                <div className="mb-2">เชื่อมต่อกับ server: <strong>{backendUrl}</strong></div>
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
                  <Select value={username} onValueChange={setUsername}>
                    <SelectTrigger className="w-full px-3 py-2 ">
                      <SelectValue placeholder="Select a username" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Usernames</SelectLabel>
                        {
                          listusernames.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))
                        }
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">รหัสผ่าน</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
                </div>
                <div className="flex justify-end">
                  <Button className="btn btn-primary bg-emerald-500 hover:bg-emerald-600" onClick={() => handleLogin()}>เข้าสู่ระบบ</Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {loadingMain && backendConnected && readerReady && isAuthenticated ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <div className="text-lg font-medium">กำลังโหลดข้อมูล...</div>
          <div className="w-[60%]">
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      ) : cardData ? (
        backendConnected && isAuthenticated && readerReady ? (
          <Main
            cardData={cardData}
            onCancel={handleCancel}
            backendUrl={backendUrl}
            username={username}
            HOSPITAL_NAME={HOSPITAL_NAME}
            LOGO={LOGO}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-lg font-semibold">⚠️ ไม่สามารถแสดงข้อมูลได้</div>
            {!backendConnected && <div>❌ การเชื่อมต่อ Backend หลุด</div>}
            {!isAuthenticated && <div>🔒 ออกจากระบบแล้ว</div>}
            {!readerReady && <div>💳 การเชื่อมต่อเครื่องอ่านบัตรหลุด</div>}
            <div className="text-sm text-gray-500 mt-2">กรุณาตรวจสอบและลองอีกครั้ง (อาจจะต้องเริ่มใหม่)</div>
          </div>
        )
      ) : (
        backendConnected && isAuthenticated && readerReady ? (
          <Home 
          HOSPITAL_NAME={HOSPITAL_NAME}
          LOGO={LOGO}
          />
        ) : (
          null
        )
      )}

      {/* <Footer /> */}
    </main>
  );
}

export default App;