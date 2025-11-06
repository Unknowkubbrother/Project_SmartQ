import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const App = () => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // simulate splash loading (or load persisted state)
    const t = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BackendProvider>
        <QueueProvider>
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

                  {/* Main app routes (require backend configured) */}
                  <Route path="/" element={<RequireBackend><QueueList /></RequireBackend>} />
                  <Route path="/call-queue" element={<RequireBackend><CallQueue /></RequireBackend>} />
                  <Route path="/display" element={<RequireBackend><DisplayBoard /></RequireBackend>} />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            )}
          </TooltipProvider>
        </QueueProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
};

export default App;
