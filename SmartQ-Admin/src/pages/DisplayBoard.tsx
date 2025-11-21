import React, { useEffect, useState, useRef } from "react";
import { useBackend } from "@/contexts/BackendContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Radio,
  Clock,
  ArrowRight,
  ArrowLeftFromLine,
  VolumeX,
  User,
  MonitorPlay,
  Image as ImageIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import ReactPlayer from "react-player";

const cn = (
  ...classes: (
    | string
    | boolean
    | undefined
    | Record<string, boolean | undefined>
  )[]
) => {
  return classes
    .map((c) => {
      if (!c) return "";
      if (typeof c === "string") return c;
      if (typeof c === "object") {
        return Object.entries(c)
          .filter(([, v]) => !!v)
          .map(([k]) => k)
          .join(" ");
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
};


interface ServiceDef {
  name: string;
  label?: string;
  counters?: { name: string; code: string }[];
  color?: string;
}

interface ServiceState {
  name: string;
  label: string;
  current: any | null;
  next: any | null;
  queues: any[];
  muted?: boolean;
  isCalling?: boolean;
  lastCalledTimestamp: number;
}

const DisplayBoard: React.FC = () => {
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [stateMap, setStateMap] = useState<Record<string, ServiceState>>({});
  const wsRefs = useRef<Record<string, WebSocket | null>>({});
  const audioRefs = useRef<
    Record<string, { audio: HTMLAudioElement | null; url: string | null }>
  >({});
  const callTimersRef = useRef<Record<string, number | null>>({});
  
  
  const { backendUrl, initalData } = useBackend();

  
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const base = backendUrl ? backendUrl.replace(/\/$/, "") : "";
        const res = await fetch((base || "") + "/api/queue/services");
        if (!res.ok) return;
        const data = await res.json();
        setServices(data);
      } catch (e) {
        console.error("Failed to fetch services", e);
      }
    };
    if (backendUrl) fetchServices();
  }, [backendUrl]);

  
  useEffect(() => {
    let mounted = true;
    services.forEach((s) => {
      const service = s.name;
      if (!backendUrl) return;
      let wsUrl = backendUrl.replace(/\/$/, "");
      if (wsUrl.startsWith("http://"))
        wsUrl = wsUrl.replace("http://", "ws://");
      else if (wsUrl.startsWith("https://"))
        wsUrl = wsUrl.replace("https://", "wss://");
      else wsUrl = "ws://" + wsUrl;
      wsUrl = `${wsUrl}/api/queue/ws/${service}?role=display`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRefs.current[service] = ws;

        ws.onopen = () =>
          console.debug(`[DisplayBoard] WS connected for ${service}`);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            const triggerCallAnimation = (duration = 2500) => {
              if (callTimersRef.current[service]) {
                clearTimeout(callTimersRef.current[service] as number);
                callTimersRef.current[service] = null;
              }
              setStateMap((prev) => {
                const cur = prev[service] || {
                  name: service,
                  label: s.label || service,
                  current: null,
                  next: null,
                  queues: [],
                  muted: false,
                  lastCalledTimestamp: 0,
                };
                return { ...prev, [service]: { ...cur, isCalling: true } };
              });
              callTimersRef.current[service] = window.setTimeout(() => {
                setStateMap((prev) => {
                  const st = prev[service];
                  if (!st) return prev;
                  return { ...prev, [service]: { ...st, isCalling: false } };
                });
                callTimersRef.current[service] = null;
              }, duration);
            };

            setStateMap((prev) => {
              const cur = prev[service] || {
                name: service,
                label: s.label || service,
                current: null,
                next: null,
                queues: [],
                muted: false,
                lastCalledTimestamp: 0,
              };
              if (msg.type === "queue_update") {
                const queues = msg.queue || [];
                
                const next = queues.length > 0 ? queues[0] : null; 
                return { ...prev, [service]: { ...cur, queues, next } };
              } else if (msg.type === "current") {
                const now = Date.now();
                const newState = { ...cur, current: msg.item || null };
                if (msg.item) {
                  
                  (newState as ServiceState).lastCalledTimestamp = now;
                  (newState as ServiceState).isCalling = true;
                }
                return { ...prev, [service]: newState };
              } else if (msg.type === "status") {
                return { ...prev, [service]: { ...cur, muted: msg.muted } };
              }
              return prev;
            });

            if (msg.type === "current" && msg.item) {
              triggerCallAnimation();
            }

            if (msg.type === "audio") {
              if (!mounted) return;
              try {
                triggerCallAnimation(3000);

                const entry = audioRefs.current[service] || {
                  audio: null,
                  url: null,
                };
                if (entry.audio) {
                  try {
                    entry.audio.pause();
                    entry.audio.currentTime = 0;
                  } catch (e) {}
                }
                if (entry.url) {
                  try {
                    URL.revokeObjectURL(entry.url);
                  } catch (e) {}
                }

                const b64 = msg.data;
                const byteCharacters = atob(b64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++)
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "audio/mp3" });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);

                try {
                  const prev = audioRefs.current[service];
                  if (prev?.audio) {
                    try {
                      prev.audio.pause();
                      prev.audio.src = "";
                    } catch (e) {}
                  }
                  if (prev?.url) {
                    try {
                      URL.revokeObjectURL(prev.url);
                    } catch (e) {}
                  }
                } catch (e) {}

                audioRefs.current[service] = { audio, url };
                audio.play().catch(() => {});
                audio.onended = () => {
                  try {
                    audio.pause();
                    audio.src = "";
                  } catch (e) {}
                  try {
                    URL.revokeObjectURL(url);
                  } catch (e) {}
                  if (audioRefs.current[service]?.audio === audio)
                    audioRefs.current[service].audio = null;
                  if (audioRefs.current[service]?.url === url)
                    audioRefs.current[service].url = null;
                };
              } catch (e) {
                console.error("Failed to play audio", e);
              }
            }
          } catch (err) {
            console.error("Invalid WS message", err);
          }
        };

        ws.onclose = () => {
          wsRefs.current[service] = null;
          console.debug(`[DisplayBoard] WS closed for ${service}`);
        };
      } catch (e) {
        console.error("WS error", e);
      }
    });

    return () => {
      mounted = false;

      Object.values(wsRefs.current).forEach((w) => w && w.close());

      Object.values(callTimersRef.current).forEach((t) => t && clearTimeout(t));
      callTimersRef.current = {};

      Object.values(audioRefs.current).forEach((entry) => {
        try {
          if (entry?.audio) {
            try {
              entry.audio.pause();
              entry.audio.onended = null;
              entry.audio.src = "";
            } catch (e) {}
            entry.audio = null;
          }
          if (entry?.url) {
            try {
              URL.revokeObjectURL(entry.url);
            } catch (e) {}
            entry.url = null;
          }
        } catch (e) {}
      });
      audioRefs.current = {};
    };
  }, [services]);

  
  const videoEnabled = !!initalData?.VIDEO_URL;
  const imageEnabled = !!(initalData as any)?.IMAGE_URL;

  const [mediaMode, setMediaMode] = useState<"video" | "image">(() => {
    try {
      const v = localStorage.getItem("display_media_mode");
      if (v === "video" || v === "image") return v;
    } catch (e) {}
    return videoEnabled ? "video" : imageEnabled ? "image" : "video";
  });

  useEffect(() => {
    try {
      localStorage.setItem("display_media_mode", mediaMode);
    } catch (e) {}
  }, [mediaMode]);

  useEffect(() => {
    if (mediaMode === "video" && !videoEnabled && imageEnabled) setMediaMode("image");
    if (mediaMode === "image" && !imageEnabled && videoEnabled) setMediaMode("video");
  }, [videoEnabled, imageEnabled]);
  
  
  
  const visibleServiceDefs = services.filter(s => stateMap[s.name]?.current);
  
  const sortedVisibleServices = visibleServiceDefs
    .map(s => {
      
      const state = stateMap[s.name];
      const lastCalledTime = state?.lastCalledTimestamp || 0;
      return { def: s, state: state, lastCalled: lastCalledTime };
    })
    .filter(item => item.state?.current) 
    
    .sort((a, b) => {
        
        if (a.lastCalled !== b.lastCalled) {
            return b.lastCalled - a.lastCalled; 
        }
        
        return a.def.name.localeCompare(b.def.name);
    });

  
  const numVisible = sortedVisibleServices.length || 1;
  
  
  const cardHeightClass = cn({
      "max-h-[30vh]": numVisible === 1,
      "max-h-[23vh]": numVisible === 2,
      "flex-1": numVisible >= 3,
  });

  

  return (
    
    <div className="h-screen flex justify-start items-center flex-col bg-gradient-to-br from-sky-50 via-white to-slate-50 p-4 lg:p-6">
      
      <header className="text-center mb-3 sm:mb-5 w-full relative">
        <Link to="/start" className="absolute left-0 top-1/2 transform -translate-y-1/2">
          <Button
            variant="outline"
            className="inline-flex items-center gap-2 text-sky-600 hover:bg-sky-50 transition-colors text-sm px-4 py-2"
          >
            <ArrowLeftFromLine className="w-4 h-4" /> กลับไปเลือกบริการ
          </Button>
        </Link>
        <div className="inline-flex items-center gap-4 bg-sky-600/10 px-6 py-2 rounded-2xl shadow-xl border border-sky-400 transform transition-all hover:scale-[1.01] duration-300">
          <Radio className="text-sky-600 w-7 h-7 lg:w-9 lg:h-9 animate-pulse" />
          <h1 className="text-3xl sm:text-4xl lg:text-4xl font-extrabold text-sky-800 tracking-wider">
            {initalData?.HOSPITAL_NAME || "Queue Display"}
          </h1>
        </div>
      </header>
      
      
      <div
        className={cn(
          "w-full flex gap-4 lg:gap-6 flex-col md:flex-row flex-1 max-w-full overflow-hidden",
          {
            "items-stretch": videoEnabled,
            "justify-center": !videoEnabled,
          }
        )}
      >
        
        {(videoEnabled || imageEnabled) && (
          <div className="md:w-[65%] flex flex-col items-stretch">
            <div className="flex items-center justify-between text-slate-700 mb-2 border-b pb-1 border-slate-200">
              <div className="flex items-center">
                <MonitorPlay className="w-5 h-5 mr-2 text-sky-600" />
                <h2 className="text-lg font-bold lg:text-xl">Video/Advertisements</h2>
              </div>
              <div className="flex items-center gap-2">
                {videoEnabled && (
                  <button
                    onClick={() => setMediaMode("video")}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium shadow-sm transition",
                      mediaMode === "video"
                        ? "bg-sky-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    )}
                  >
                    <MonitorPlay className="w-4 h-4" />
                    <span>Video</span>
                  </button>
                )}
                {imageEnabled && (
                  <button
                    onClick={() => setMediaMode("image")}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium shadow-sm transition",
                      mediaMode === "image"
                        ? "bg-sky-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    )}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Image</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl flex-1 bg-gray-200 border-4 border-slate-300">
              {mediaMode === "video" && videoEnabled ? (
                <ReactPlayer
                  src={initalData.VIDEO_URL}
                  width="100%"
                  height="100%"
                  controls={false}
                  playing
                  volume={0}
                  muted={true}
                  loop
                />
                ) : mediaMode === "image" && imageEnabled ? (
                <img
                  src={(initalData as any)?.IMAGE_URL}
                  alt="Display"
                  className="w-full h-full object-cover"
                />
              ) : (
                
                videoEnabled ? (
                  <ReactPlayer
                    src={initalData.VIDEO_URL}
                    width="100%"
                    height="100%"
                    controls={false}
                    playing
                    volume={0}
                    muted={true}
                    loop
                  />
                ) : imageEnabled ? (
                  <img
                    src={(initalData as any)?.IMAGE_URL}
                    alt="Display"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    ไม่มีสื่อแสดงผล
                  </div>
                )
              )}
            </div>
          </div>
        )}

        
        <div
          className={cn(
            "p-3 lg:p-4 bg-white/90 rounded-xl shadow-2xl backdrop-blur-sm flex flex-col mb-3 mr-3 border border-slate-200", 
            
            videoEnabled ? "md:w-[35%]" : "w-full max-w-full"
          )}
        >
          <div className="flex items-center text-sky-700 mb-3 pb-2 border-b border-sky-300">
            <Clock className="w-5 h-5 mr-2"/>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-cyan-500">คิวกำลังเรียก</h2>
          </div>
          
          
          <section className="grid gap-3 flex-1 grid-cols-1 overflow-y-auto">
            {sortedVisibleServices.map((item) => {
              const { def: s, state: st } = item;
              const current = st?.current;
              const next = st?.next;
              
              const color = s.color || "from-sky-500 to-indigo-600"; 

              const isGradient =
                typeof color === "string" &&
                (color.includes("from-") || color.includes("to-"));
              const bgClass = isGradient
                ? `bg-gradient-to-br ${color}`
                : "bg-sky-600";
              const bgStyle = !isGradient
                ? ({ background: color } as React.CSSProperties)
                : undefined;

              const isCalling = st?.isCalling;

              return (
                <Card
                  key={s.name}
                  
                  className={cn(
                    "border-3 border-white shadow-lg transition-all duration-300 bg-white rounded-xl flex flex-col justify-between relative",
                    cardHeightClass,
                  )}
                >
                  
                  <div className="flex flex-col flex-1">
                    
                    
                    <div className="p-3 lg:p-4 pb-2 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base lg:text-lg font-bold text-sky-800 truncate">
                          {s.label || s.name}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            st?.muted
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {st?.muted ? (
                            <VolumeX className="w-3 h-3 mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {st?.muted ? "เปิดเสียง" : "กำลังรอ"}
                        </span>
                      </div>
                    </div>

                    
                    <div className="flex items-stretch gap-3 flex-1 p-3 lg:p-4"> 
                      
                      
                      <div
                        className={cn(
                          
                          "flex-shrink-0 w-24 sm:w-28 rounded-lg text-white flex items-center justify-center shadow-xl transition-all duration-500",
                          "aspect-square",
                          
                          "relative z-10", 
                        )}
                        
                      >
                        
                        <div 
                          className={cn(
                            "text-center leading-none aspect-square transition-all duration-300 rounded-lg w-full h-full flex flex-col items-center justify-center", 
                            bgClass, 
                            {
                              
                              "shadow-2xl shadow-sky-400/50 transform scale-[1.03] ring-4 ring-white/50": isCalling
                            }
                          )}
                          style={{ ...bgStyle }} 
                        >
                            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight drop-shadow-md">
                              {current.Q_number}
                            </div>
                            <div className="text-xs sm:text-sm opacity-90 font-medium mt-1">
                              {current.counter
                                ? `${current.counter}` 
                                : "เรียก"}
                            </div>
                          </div>
                      </div>

                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="text-xs lg:text-sm font-semibold text-slate-500 mb-0.5">
                          ผู้รับบริการ
                        </div>
                        <div className="text-base sm:text-xl lg:text-2xl font-extrabold text-sky-800 truncate leading-snug mb-1">
                            {current.FULLNAME_TH}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center bg-slate-50 p-1 rounded-lg">
                            <User className="w-3 h-3 mr-1 text-sky-600" />
                            คิว: <span className="font-bold ml-1">{current.Q_number}</span>
                        </div>
                      </div>
                    </div>

                    
                    <div className="w-full pt-2 border-t border-slate-100 p-3 lg:p-4">
                        <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-orange-500" /> 
                            คิวถัดไป
                        </div>
                        {next ? (
                            <div className="text-xs font-bold text-slate-800 truncate bg-orange-100/70 p-1.5 rounded-lg border-l-3 border-orange-500 transition-colors duration-300 hover:bg-orange-200">
                                {next.Q_number} — {next.FULLNAME_TH}
                            </div>
                        ) : (
                             <div className="text-xs text-slate-500 bg-slate-100 p-1.5 rounded-lg">
                                ไม่มีคิวรอถัดไป
                            </div>
                        )}
                    </div>
                    
                  </div>
                </Card>
              );
            })}
          </section>

          
          {sortedVisibleServices.length === 0 && (
              
              <div className="flex items-center justify-center h-full">
                <p className="text-xl lg:text-2xl font-medium text-slate-400 p-6 rounded-xl border-3 border-dashed border-slate-300">
                    <Clock className="w-6 h-6 inline mr-2" />
                    ไม่มีคิวกำลังให้บริการ
                </p>
              </div>
          )}

        </div>
      </div>
    
    </div>
  );
};

export default DisplayBoard;