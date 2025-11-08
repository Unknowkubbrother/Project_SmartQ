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
}

const DisplayBoard: React.FC = () => {
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [stateMap, setStateMap] = useState<Record<string, ServiceState>>({});
  const wsRefs = useRef<Record<string, WebSocket | null>>({});
  const audioRefs = useRef<Record<string, { audio: HTMLAudioElement | null; url: string | null }>>({});

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
            setStateMap(prev => {
              const cur = prev[service] || { name: service, label: s.label || service, current: null, next: null, queues: [], muted: false };
              if (msg.type === 'queue_update') {
                const queues = msg.queue || [];
                // next is first waiting
                const next = queues.find((q: any) => true) || null;
                return { ...prev, [service]: { ...cur, queues, next } };
              } else if (msg.type === 'current') {
                return { ...prev, [service]: { ...cur, current: msg.item || null } };
              } else if (msg.type === 'status') {
                return { ...prev, [service]: { ...cur, muted: msg.muted } };
              }
              return prev;
            });

            // play audio messages on display (per-service). stop prior audio for this service first.
            if (msg.type === 'audio') {
              try {
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
    };
  }, [services]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-slate-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-sky-600/10 px-4 py-2 rounded-full shadow-sm">
            <Radio className="text-sky-600" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-sky-700">หน้าจอประกาศรวม</h1>
          </div>
          <p className="mt-3 text-sm sm:text-base text-slate-600">แสดงสถานะคิวปัจจุบันของแต่ละบริการ — ธีมโรงพยาบาล สีฟ้า ออกแบบให้ตอบสนองหน้าจอทุกขนาด</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {services.map(s => {
            const st = stateMap[s.name];
            const current = st?.current;
            const next = st?.next;

            return (
              <Card key={s.name} className="p-4 sm:p-5 border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-sky-700 truncate">{s.label || s.name}</h3>
                        <p className="text-xs text-slate-500 truncate">บริการ: {s.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          st?.muted ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {st?.muted ? <VolumeX className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                          {st?.muted ? 'ปิดเสียง' : 'เสียงเปิด'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-lg bg-gradient-to-br from-sky-600 to-sky-500 text-white flex items-center justify-center shadow-inner">
                        {current ? (
                          <div className="text-center">
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">{current.Q_number}</div>
                            <div className="text-xs sm:text-sm opacity-90">{current.counter ? `ช่อง ${current.counter}` : 'รอเรียก'}</div>
                          </div>
                        ) : (
                          <div className="text-center text-sky-100">
                            <div className="text-xl sm:text-2xl font-semibold">-</div>
                            <div className="text-xs sm:text-sm">ไม่มีคิว</div>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="text-sm text-slate-700 mb-1 font-medium">คิวปัจจุบัน</div>
                        {current ? (
                          <div className="text-sm sm:text-base text-slate-800 mb-2">{current.FULLNAME_TH}</div>
                        ) : (
                          <div className="text-sm text-slate-400 mb-2">ไม่มีคิวกำลังเรียก</div>
                        )}

                        <div className="text-sm text-slate-600 mb-2 font-medium flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-sky-500" /> คิวถัดไป
                        </div>
                        {next ? (
                          <div className="text-sm sm:text-sm text-slate-800">{next.Q_number} — {next.FULLNAME_TH}</div>
                        ) : (
                          <div className="text-sm text-slate-400">ไม่มีคิวรอ</div>
                        )}
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
