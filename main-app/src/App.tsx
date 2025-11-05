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

  useEffect(() => {
    let unlistenData: UnlistenFn | null = null;
    let unlistenError: UnlistenFn | null = null;

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

      unlistenError = await listen("thai_id_error", (event) => {
        console.error("Error received:", event.payload);
        // const payload = event.payload;
        // if (typeof payload === "string") {
        //   setErrorMessage(payload);
        // }
        setCardData(null)
      });
    };

    setupListeners();
    return () => {
      if (unlistenData) unlistenData();
      if (unlistenError) unlistenError();
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

      <Footer />
    </main>
  );
}

export default App;