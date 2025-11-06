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
  counter?: number;
  service?: string;
}

interface ServerHistoryItem {
  Q_number: number;
  FULLNAME_TH: string;
  service: string;
}

interface QueueContextType {
  queues: Queue[];
  currentQueue: Queue | null;
  history: ServerHistoryItem[];
  // include processed_count so consumers can read total processed from server
  serverStatus: { online: number; queue_length: number; muted?: boolean; processed_count?: number } | null;
  addQueue: (name: string) => void;
  callNextQueue: () => void;
  callAgain: () => void;
  completeQueue: (id: string) => void;
  setMute?: (muted: boolean) => Promise<void>;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

// BroadcastChannel for cross-tab communication
const channel = typeof window !== 'undefined' ? new BroadcastChannel('queue_channel') : null;

export const QueueProvider = ({ children }: { children: ReactNode }) => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);
  const { backendUrl } = useBackend();
  const wsRef = useRef<WebSocket | null>(null);
  const location = useLocation();
  const [history, setHistory] = useState<ServerHistoryItem[]>([]);
  const [serverStatus, setServerStatus] = useState<{ online: number; queue_length: number; muted?: boolean; processed_count?: number } | null>(null);

  // If no backend configured, initialize with mock data for offline/dev
  useEffect(() => {
    if (backendUrl) return;
    const mockQueues: Queue[] = [
      { id: '1', queueNumber: 1, customerName: 'สมชาย ใจดี', status: 'completed', timestamp: new Date(), counter: 1 },
      { id: '2', queueNumber: 2, customerName: 'สมหญิง รักสุข', status: 'completed', timestamp: new Date(), counter: 1 },
      { id: '3', queueNumber: 3, customerName: 'วิชัย มั่นคง', status: 'waiting', timestamp: new Date() },
      { id: '4', queueNumber: 4, customerName: 'สุดา สวยงาม', status: 'waiting', timestamp: new Date() },
      { id: '5', queueNumber: 5, customerName: 'ประเสริฐ ดีมาก', status: 'waiting', timestamp: new Date() },
      { id: '6', queueNumber: 6, customerName: 'มานะ สู้งาน', status: 'waiting', timestamp: new Date() },
      { id: '7', queueNumber: 7, customerName: 'วรรณา สดใส', status: 'waiting', timestamp: new Date() },
    ];
    setQueues(mockQueues);
  }, [backendUrl, location.pathname, serverStatus?.muted]);

  // Listen to BroadcastChannel messages
  useEffect(() => {
    if (!channel) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      
      if (type === 'CALL_QUEUE') {
        setQueues(prev => prev.map(q => 
          q.id === payload.id ? { ...q, status: 'calling' as QueueStatus, counter: payload.counter } : q
        ));
        setCurrentQueue(payload);
      } else if (type === 'COMPLETE_QUEUE') {
        setQueues(prev => prev.map(q => 
          q.id === payload.id ? { ...q, status: 'completed' as QueueStatus } : q
        ));
        setCurrentQueue(null);
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  }, []);

  // WebSocket: connect to backend when backendUrl is set
  useEffect(() => {
    if (!backendUrl) {
      // close existing socket if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

  // determine role by current path
  const role = (typeof window !== 'undefined' && location && location.pathname.startsWith('/display')) ? 'display' : 'client';

  // build ws url
  let wsUrl = backendUrl.replace(/\/$/, '');
    if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
    else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
    else wsUrl = 'ws://' + wsUrl;
  wsUrl = wsUrl + '/ws' + `?role=${role}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.debug('[QueueContext] WebSocket connected', wsUrl);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'queue_update') {
            // map server queue items to local Queue type
            const serverQueue = msg.queue as Array<any>;
            const mapped: Queue[] = serverQueue.map((q: any) => ({
              id: String(q.Q_number),
              queueNumber: q.Q_number,
              customerName: q.FULLNAME_TH,
              status: 'waiting',
              timestamp: new Date(),
              service: q.service,
            }));
            setQueues(mapped);
          } else if (msg.type === 'status') {
            // update server status (include processed_count when provided by server)
            setServerStatus({ online: msg.online, queue_length: msg.queue_length, muted: msg.muted, processed_count: msg.processed_count });
          } else if (msg.type === 'current') {
            // current item being called
            const it = msg.item;
            const mappedCurrent: Queue = {
              id: String(it.Q_number),
              queueNumber: it.Q_number,
              customerName: it.FULLNAME_TH,
              status: 'calling',
              timestamp: new Date(),
              service: it.service,
            };
            setCurrentQueue(mappedCurrent);
          } else if (msg.type === 'complete') {
            // a completed item was recorded on server
            const qnum = msg.Q_number;
            setQueues(prev => prev.map(q => q.id === String(qnum) ? { ...q, status: 'completed' as QueueStatus } : q));
            if (currentQueue && currentQueue.id === String(qnum)) {
              setCurrentQueue(null);
            }
          } else if (msg.type === 'history') {
            setHistory(msg.history || []);
          } else if (msg.type === 'audio') {
            // Only play audio on display role
            if (role !== 'display') return;
            if (serverStatus && serverStatus.muted) return;
            try {
              const audioData = msg.data as string;
              const blob = b64ToBlob(audioData, 'audio/mp3');
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audio.play().catch(() => {/* ignore play errors */});
            } catch (err) {
              console.error('Failed to play audio', err);
            }
          }
        } catch (err) {
          console.error('Invalid WS message', err);
        }
      };

      ws.onclose = () => {
        console.debug('[QueueContext] WebSocket closed');
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
  }, [backendUrl, location.pathname, serverStatus?.muted]);

  // helper: convert base64 to Blob
  const b64ToBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  };

  const addQueue = async (name: string) => {
    if (backendUrl) {
      try {
        const endpoint = backendUrl.replace(/\/$/, '') + '/enqueue';
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ FULLNAME_TH: name, service: 'general' }),
        });
        // backend will broadcast updated queue via websocket
        return;
      } catch (e) {
        console.error('Failed to enqueue to backend', e);
      }
    }

    // fallback local
    const newQueue: Queue = {
      id: Date.now().toString(),
      queueNumber: queues.length + 1,
      customerName: name,
      status: 'waiting',
      timestamp: new Date(),
    };
    setQueues(prev => [...prev, newQueue]);
  };

  const callNextQueue = async () => {
    if (backendUrl) {
      try {
        const endpoint = backendUrl.replace(/\/$/, '') + '/dequeue';
        const res = await fetch(endpoint, { method: 'POST' });
        const data = await res.json();
        if (data && data.item) {
          const item = data.item;
          const updatedQueue: Queue = {
            id: String(item.Q_number),
            queueNumber: item.Q_number,
            customerName: item.FULLNAME_TH,
            status: 'calling',
            timestamp: new Date(),
            counter: undefined,
          };
          setCurrentQueue(updatedQueue);
        }
        // backend will broadcast queue_update and audio
        return;
      } catch (e) {
        console.error('Failed to dequeue from backend', e);
      }
    }

    const nextQueue = queues.find(q => q.status === 'waiting');
    if (nextQueue) {
      const updatedQueue = { ...nextQueue, status: 'calling' as QueueStatus, counter: 1 };
      setQueues(prev => prev.map(q => q.id === nextQueue.id ? updatedQueue : q));
      setCurrentQueue(updatedQueue);
      
      // Broadcast to other tabs
      channel?.postMessage({ type: 'CALL_QUEUE', payload: updatedQueue });
    }
  };

  const callAgain = () => {
    if (currentQueue) {
      // no server endpoint for re-announcing; use BroadcastChannel for local tabs
      channel?.postMessage({ type: 'CALL_QUEUE', payload: currentQueue });
    }
  };

  const setMute = async (muted: boolean) => {
    if (!backendUrl) return;
    try {
      await fetch(backendUrl.replace(/\/$/, '') + '/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      });
    } catch (e) {
      console.error('Failed to set mute', e);
    }
  };

  const completeQueue = (id: string) => {
    // If backend present, call server to mark completed (server will broadcast history/status/complete)
    if (backendUrl) {
      const qToComplete = currentQueue && currentQueue.id === id ? currentQueue : queues.find(q => q.id === id);
      if (qToComplete) {
        fetch(backendUrl.replace(/\/$/, '') + '/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Q_number: qToComplete.queueNumber, FULLNAME_TH: qToComplete.customerName, service: qToComplete.service || '' }),
        }).catch(e => console.error('Failed to notify backend of completion', e));
        return;
      }
    }

    // fallback local behavior
    setQueues(prev => prev.map(q => q.id === id ? { ...q, status: 'completed' as QueueStatus } : q));
    if (currentQueue?.id === id) {
      setCurrentQueue(null);
    }
    channel?.postMessage({ type: 'COMPLETE_QUEUE', payload: { id } });
  };

  return (
    <QueueContext.Provider value={{ queues, currentQueue, history, serverStatus, addQueue, callNextQueue, callAgain, completeQueue, setMute }}>
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within QueueProvider');
  }
  return context;
};
