import React, { useEffect, useState, useRef } from 'react';
import { useBackend } from '@/contexts/BackendContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Clock, ArrowRight, ArrowLeftFromLine, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ServiceDef {
  name: string;
  label?: string;
  counters?: { name: string; code: string }[];
}

interface ServiceState {
  name: string;
  label: string;
  current: any | null;
  next: any | null;
  queues: any[];
  muted?: boolean;
  isCalling?: boolean; // เพิ่ม flag สำหรับ animation
}

const DisplayBoard: React.FC = () => {
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [stateMap, setStateMap] = useState<Record<string, ServiceState>>({});
  const wsRefs = useRef<Record<string, WebSocket | null>>({});
  const audioRefs = useRef<Record<string, { audio: HTMLAudioElement | null; url: string | null }>>({});
  const callTimersRef = useRef<Record<string, number | null>>({}); // เก็บ timers ของ animation

  const { backendUrl } = useBackend();

  useEffect(() => {
    // fetch service definitions
    const fetchServices = async () => {
      try {
        const base = backendUrl ? backendUrl.replace(/\/$/, '') : '';
        const res = await fetch((base || '') + '/api/queue/services');
        if (!res.ok) return;
        const data = await res.json();
        setServices(data);
      } catch (e) {
        console.error('Failed to fetch services', e);
      }
    };
    if (backendUrl) fetchServices();
  }, [backendUrl]);

  useEffect(() => {
    // open websocket for each service
    services.forEach((s) => {
      const service = s.name;
      if (!backendUrl) return;
      let wsUrl = backendUrl.replace(/\/$/, '');
      if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
      else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
      else wsUrl = 'ws://' + wsUrl;
      wsUrl = `${wsUrl}/api/queue/ws/${service}?role=display`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRefs.current[service] = ws;

        ws.onopen = () => console.debug(`[DisplayBoard] WS connected for ${service}`);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            // ถ้าเป็นการอัปเดต current / audio ให้ตั้ง isCalling = true เพื่อแสดง animation ชั่วคราว
            const triggerCallAnimation = (duration = 2500) => {
              // เคลียร์ timer เก่า
              if (callTimersRef.current[service]) {
                clearTimeout(callTimersRef.current[service] as number);
                callTimersRef.current[service] = null;
              }
              setStateMap(prev => {
                const cur = prev[service] || { name: service, label: s.label || service, current: null, next: null, queues: [], muted: false };
                return { ...prev, [service]: { ...cur, isCalling: true } };
              });
              // ปิด animation หลังจาก duration
              callTimersRef.current[service] = window.setTimeout(() => {
                setStateMap(prev => {
                  const st = prev[service];
                  if (!st) return prev;
                  return { ...prev, [service]: { ...st, isCalling: false } };
                });
                callTimersRef.current[service] = null;
              }, duration);
            };

            setStateMap(prev => {
              const cur = prev[service] || { name: service, label: s.label || service, current: null, next: null, queues: [], muted: false };
              if (msg.type === 'queue_update') {
                const queues = msg.queue || [];
                const next = queues.find((q: any) => true) || null;
                return { ...prev, [service]: { ...cur, queues, next } };
              } else if (msg.type === 'current') {
                // ถ้ามี item ใหม่ ให้ trigger animation
                const newState = { ...cur, current: msg.item || null };
                if (msg.item) {
                  // ติด flag isCalling เพื่อเล่น animation
                  (newState as ServiceState).isCalling = true;
                }
                return { ...prev, [service]: newState };
              } else if (msg.type === 'status') {
                return { ...prev, [service]: { ...cur, muted: msg.muted } };
              }
              return prev;
            });

            if (msg.type === 'current' && msg.item) {
              triggerCallAnimation();
            }

            // play audio messages on display (per-service). stop prior audio for this service first.
            if (msg.type === 'audio') {
              try {
                // trigger animation เมื่อมี audio เรียก
                triggerCallAnimation(3000);

                const entry = audioRefs.current[service] || { audio: null, url: null };
                if (entry.audio) {
                  try { entry.audio.pause(); entry.audio.currentTime = 0; } catch (e) {}
                }
                if (entry.url) {
                  try { URL.revokeObjectURL(entry.url); } catch (e) {}
                }

                const b64 = msg.data;
                const byteCharacters = atob(b64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRefs.current[service] = { audio, url };
                audio.play().catch(() => {});
                audio.onended = () => {
                  try { URL.revokeObjectURL(url); } catch (e) {}
                  if (audioRefs.current[service]?.audio === audio) audioRefs.current[service].audio = null;
                  if (audioRefs.current[service]?.url === url) audioRefs.current[service].url = null;
                };
              } catch (e) {
                console.error('Failed to play audio', e);
              }
            }
          } catch (err) {
            console.error('Invalid WS message', err);
          }
        };

        ws.onclose = () => {
          wsRefs.current[service] = null;
          console.debug(`[DisplayBoard] WS closed for ${service}`);
        };
      } catch (e) {
        console.error('WS error', e);
      }
    });

    return () => {
      Object.values(wsRefs.current).forEach((w) => w && w.close());
      // เคลียร์ timers animation
      Object.values(callTimersRef.current).forEach(t => t && clearTimeout(t));
      callTimersRef.current = {};
      // ปิด audio และ revoke urls
      Object.values(audioRefs.current).forEach(entry => {
        try {
          if (entry?.audio) {
            entry.audio.pause();
            entry.audio = null;
          }
          if (entry?.url) {
            URL.revokeObjectURL(entry.url);
            entry.url = null;
          }
        } catch (e) {}
      });
    };
  }, [services]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-slate-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-sky-600/10 px-4 py-2 rounded-full shadow-sm">
            <Radio className="text-sky-600" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-sky-700">Announcement</h1>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6">
          {services.map(s => {
            const st = stateMap[s.name];
            const current = st?.current;
            const next = st?.next;

            return (
                <Card key={s.name} className="p-6 sm:p-7 border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 h-[300px] flex flex-col">
                <div className="flex-1 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-semibold text-sky-700 truncate">{s.label || s.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${
                      st?.muted ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                      {st?.muted ? <VolumeX className="w-4 h-4 mr-1" /> : <Clock className="w-4 h-4 mr-1" />}
                      {st?.muted ? 'ปิดเสียง' : 'เสียงเปิด'}
                      </span>
                    </div>
                    </div>

                    <div className="flex items-center gap-6">
                    <div
                      // ใส่ animation เมื่อ isCalling = true
                      className={`flex-shrink-0 w-36 h-36 sm:w-44 sm:h-44 rounded-xl bg-gradient-to-br from-sky-600 to-sky-500 text-white flex items-center justify-center shadow-inner transition-transform duration-300 ${
                      st?.isCalling ? 'scale-105 ring-4 ring-sky-300/60' : ''
                      }`}
                    >
                      {current ? (
                      <div className="text-center">
                        <div className="text-4xl sm:text-5xl font-extrabold tracking-tight">{current.Q_number}</div>
                        <div className="text-sm sm:text-base opacity-95">{current.counter ? `ช่อง ${current.counter}` : 'รอเรียก'}</div>
                      </div>
                      ) : (
                      <div className="text-center text-sky-100">
                        <div className="text-2xl sm:text-3xl font-semibold">-</div>
                        <div className="text-sm sm:text-base">ไม่มีคิว</div>
                      </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base text-slate-700 mb-1 font-medium">คิวปัจจุบัน</div>
                      {current ? (
                      <div className="text-base sm:text-lg text-slate-800 mb-2 truncate">{current.FULLNAME_TH}</div>
                      ) : (
                      <div className="text-sm text-slate-400 mb-2">ไม่มีคิวกำลังเรียก</div>
                      )}

                      <div className="text-sm sm:text-base text-slate-600 mb-2 font-medium flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-sky-500" /> คิวถัดไป
                      </div>
                      {next ? (
                      <div className="text-sm sm:text-base text-slate-800 truncate">{next.Q_number} — {next.FULLNAME_TH}</div>
                      ) : (
                      <div className="text-sm text-slate-400">ไม่มีคิวรอ</div>
                      )}
                    </div>
                    </div>
                  </div>
                  </div>
                </div>
                </Card>
            );
          })}
        </section>

        <div className="mt-8 text-center">
          <Link to="/start" className="inline-block">
            <Button variant="outline" className="inline-flex items-center gap-2 border-sky-600 text-sky-600 hover:bg-sky-50">
              <ArrowLeftFromLine /> กลับไปเลือกบริการ
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DisplayBoard;
