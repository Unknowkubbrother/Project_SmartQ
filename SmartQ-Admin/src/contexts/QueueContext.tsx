import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useBackend } from './BackendContext';
import { useLocation } from 'react-router-dom';

export type QueueStatus = 'waiting' | 'calling' | 'completed';

export interface Queue {
  id: string;
  queueNumber: number;
  customerName: string;
  status: QueueStatus;
  timestamp: Date;
  counter?: string; // 👈 เพิ่ม counter
  service?: string;
}

interface ServerHistoryItem {
  Q_number: number;
  FULLNAME_TH: string;
  service?: string;
  counter?: string; // 👈 เพิ่ม counter
  transferred?: boolean;
  completed_by?: string;
}

interface QueueContextType {
  queues: Queue[];
  currentQueue: Queue | null;
  history: ServerHistoryItem[];
  serverStatus: { online: number; queue_length: number; muted?: boolean; processed_count?: number } | null;
  addQueue: (name: string) => Promise<void>;
  callNextQueue: (selectedCounter: string) => Promise<void>;
  callAgain: () => void;
  completeQueue: (id: string) => Promise<void>;
  setMute?: (muted: boolean) => Promise<void>;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider = ({ children, serviceName = 'inspect' }: { children: ReactNode; serviceName?: string }) => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);
  const { backendUrl, operatorId } = useBackend();
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const location = useLocation();
  const [history, setHistory] = useState<ServerHistoryItem[]>([]);
  const [serverStatus, setServerStatus] = useState<{ online: number; queue_length: number; muted?: boolean; processed_count?: number } | null>(null);

  useEffect(() => {
    if (!backendUrl) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const role = location.pathname.startsWith('/display') ? 'display' : 'client';

    let wsUrl = backendUrl.replace(/\/$/, '');
    if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
    else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
    else wsUrl = 'ws://' + wsUrl;

  // backend websocket path is mounted at /api/queue/ws/{service}
  wsUrl = `${wsUrl}/api/queue/ws/${serviceName}?role=${role}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => console.debug(`[QueueContext:${serviceName}] WebSocket connected`);

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'queue_update') {
            const mapped: Queue[] = (msg.queue || []).map((q: any) => ({
              id: String(q.Q_number),
              queueNumber: q.Q_number,
              customerName: q.FULLNAME_TH,
              status: 'waiting',
              timestamp: new Date(),
              service: q.service,
              counter: q.counter,
            }));
            setQueues(mapped);
          } else if (msg.type === 'status') {
            setServerStatus({
              online: msg.online,
              queue_length: msg.queue_length,
              muted: msg.muted,
              processed_count: msg.processed_count,
            });
          } else if (msg.type === 'current') {
            const it = msg.item;
            if (!it) setCurrentQueue(null);
            else
              setCurrentQueue({
                id: String(it.Q_number),
                queueNumber: it.Q_number,
                customerName: it.FULLNAME_TH,
                status: 'calling',
                timestamp: new Date(),
                service: it.service,
                counter: it.counter,
              });
          } else if (msg.type === 'complete') {
            const qnum = msg.Q_number;
            setQueues((prev) =>
              prev.map((q) =>
                q.id === String(qnum) ? { ...q, status: 'completed' as QueueStatus } : q
              )
            );
            setCurrentQueue(prev => (prev?.id === String(qnum) ? null : prev));
          } else if (msg.type === 'history') {
            setHistory(msg.history || []);
          } else if (msg.type === 'audio') {
            if (role !== 'display') return;
            if (serverStatus?.muted) return;
            try {
              // stop previous audio if playing
              if (audioRef.current) {
                try {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                } catch (e) {}
              }
              if (audioUrlRef.current) {
                try { URL.revokeObjectURL(audioUrlRef.current); } catch (e) {}
                audioUrlRef.current = null;
              }

              const blob = b64ToBlob(msg.data, 'audio/mp3');
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioRef.current = audio;
              audioUrlRef.current = url;
              audio.play().catch(() => {});
              audio.onended = () => {
                try { URL.revokeObjectURL(url); } catch (e) {}
                if (audioRef.current === audio) audioRef.current = null;
                if (audioUrlRef.current === url) audioUrlRef.current = null;
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
        console.debug(`[QueueContext:${serviceName}] WebSocket closed`);
        wsRef.current = null;
      };
    } catch (e) {
      console.error('WebSocket error', e);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [backendUrl, location.pathname, serverStatus?.muted, serviceName]);

  const b64ToBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  const addQueue = async (name: string) => {
    if (!backendUrl) return;
    const endpoint = `${backendUrl.replace(/\/$/, '')}/api/queue/${serviceName}/enqueue`;
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ FULLNAME_TH: name, service: serviceName }),
    }).catch(console.error);
  };

    const callNextQueue = async (selectedCounter : string) => {
    if (!backendUrl || !selectedCounter) return;
    const endpoint = `${backendUrl.replace(/\/$/, '')}/api/queue/${serviceName}/dequeue`;
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter: selectedCounter }),
    }).catch(console.error);
  };

  const callAgain = () => {
    if (!backendUrl) return;
    fetch(`${backendUrl.replace(/\/$/, '')}/api/queue/${serviceName}/reannounce`, { method: 'POST' }).catch(console.error);
  };

  const setMute = async (muted: boolean) => {
    if (!backendUrl) return;
    await fetch(`${backendUrl.replace(/\/$/, '')}/api/queue/${serviceName}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted }),
    }).catch(console.error);
  };

  const completeQueue = async (id: string) => {
    if (!backendUrl) return;
    const q = currentQueue?.id === id ? currentQueue : queues.find(q => q.id === id);
    if (!q) return;
    try {
      await fetch(`${backendUrl.replace(/\/$/, '')}/api/queue/${serviceName}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Q_number: q.queueNumber,
          FULLNAME_TH: q.customerName,
          service: serviceName,
          completed_by: operatorId,
        }),
      });
    } catch (e) {
      console.error('completeQueue error', e);
    }
  };

  return (
    <QueueContext.Provider
      value={{ queues, currentQueue, history, serverStatus, addQueue, callNextQueue, callAgain, completeQueue, setMute }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used within QueueProvider');
  return ctx;
};

export default QueueContext;
