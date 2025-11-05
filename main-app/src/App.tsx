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

  useEffect(() => {
    let unlistenData: UnlistenFn | null = null;
    let unlistenError: UnlistenFn | null = null;
    let unlistenPhoto: UnlistenFn | null = null;

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
        }
        // cancel any pending load and clear data
        setIncomingData(null);
        setLoadingMain(false);
        setCardData(null);
        setPhotoData(null);
        setProgress(0);
      });
    };

    setupListeners();
    return () => {
      if (unlistenData) unlistenData();
      if (unlistenError) unlistenError();
      if (unlistenPhoto) unlistenPhoto();
    };
  }, []);

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
        <Main cardData={cardData} photoData={photoData} onCancel={handleCancel} />
      )}

      <Footer />
    </main>
  );
}

export default App;