import { useState, useEffect } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {ThaiIDCardData} from "@/interfaces";
import "./App.css";
import ThaiIDCard from "@/components/ThaiIDCard";
import Home from "@/pages/Home";
import Footer from "@/components/ui/footer";

function App() {
  const [cardData, setCardData] = useState<ThaiIDCardData | null>(null);
  const [, setErrorMessage] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);

  useEffect(() => {
    let unlistenData: UnlistenFn | null = null;
    let unlistenError: UnlistenFn | null = null;
    let unlistenPhoto: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenData = await listen("thai_id_data", (event) => {
        const payload = event.payload;
        const dataLine = (payload as string).split("\n");
        const dataObj: any = {};
        dataLine.forEach(line => {
          const [key, value] = line.split(":");
          dataObj[key.trim()] = value.trim();
        });
        setCardData(dataObj as ThaiIDCardData);

        setErrorMessage(null);
      });

      unlistenPhoto = await listen("thai_id_photo", (event) => {
        const payload = event.payload;
        const photoBase64 = payload as string;
        // You can handle the photoBase64 as needed, e.g., display it or store it
        setPhotoData(photoBase64);
        console.log("Received photo in Base64 format:", photoBase64);
      });

      unlistenError = await listen("thai_id_error", (event) => {
        console.error("Error received:", event.payload);
        // const payload = event.payload;
        // if (typeof payload === "string") {
        //   setErrorMessage(payload);
        // }
        setCardData(null)
        setPhotoData(null);
      });
    };

    setupListeners();
    return () => {
      if (unlistenData) unlistenData();
      if (unlistenError) unlistenError();
      if (unlistenPhoto) unlistenPhoto();
    };
  }, []);

  return (
    <main className="w-full h-lvh realative">
      <div className="w-full h-5"></div>
      {!cardData? (
        <Home />
      ) : (
        <ThaiIDCard cardData={cardData} />
      )}
      {/* {errorMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow">
          {errorMessage}
        </div> */}
      {/* )} */}
      {
        photoData && (
          <div className="absolute top-4 right-4 border p-2 bg-white">
            <img src={`data:image/jpeg;base64,${photoData}`} alt="ID Card Photo" width={100} height={120} />
          </div>
        )
      }

      <Footer />
    </main>
  );
}

export default App;