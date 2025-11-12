import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueueProvider } from "./contexts/QueueContext";
import { BackendProvider, RequireBackend } from '@/contexts/BackendContext';
import QueueList from "./pages/QueueList";
import CallQueue from "./pages/CallQueue";
import DisplayBoard from "./pages/DisplayBoard";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";
import BackendSetup from "./components/BackendSetup";
import StartChoice from "./pages/StartChoice";

const queryClient = new QueryClient();

// Wrapper เพื่อดึง serviceName จาก state แล้วส่งให้ QueueProvider
const QueueListWrapper: React.FC = () => {
  const location = useLocation();
  const serviceName = (location.state as any)?.serviceName ?? 'inspect';
  return (
    <QueueProvider serviceName={serviceName}>
      <QueueList />
    </QueueProvider>
  );
};

const CallQueueWrapper: React.FC = () => {
  const location = useLocation();
  const serviceName = (location.state as any)?.serviceName ?? 'inspect';
  return (
    <QueueProvider serviceName={serviceName}>
      <CallQueue serviceName={serviceName} />
    </QueueProvider>
  );
};

const App = () => {
   useEffect(() => {
    // ป้องกันคลิกขวา
    // const handleContextMenu = (e : any) => {
    //   e.preventDefault();
    // };

    // ป้องกัน Ctrl+C, Ctrl+U, Ctrl+Shift+I
    const handleKeyDown = (e : any) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 's')) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
      }
    };

    // document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // ลบ event listener ตอน component ถูก unmount
    return () => {
      // document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BackendProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {isLoading ? (
            <SplashScreen />
          ) : (
            <BrowserRouter>
              <Routes>
                {/* Setup flow */}
                <Route path="/setup" element={<BackendSetup />} />
                <Route path="/start" element={<StartChoice />} />

                {/* Main app routes */}
                <Route path="/queue-list" element={<RequireBackend><QueueListWrapper /></RequireBackend>} />
                <Route path="/call-queue" element={<RequireBackend><CallQueueWrapper /></RequireBackend>} />
                <Route path="/display" element={<RequireBackend><DisplayBoard /></RequireBackend>} />

                {/* Catch-all */}
                <Route path="/" element={<RequireBackend><StartChoice /></RequireBackend>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          )}
        </TooltipProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
};

export default App;
