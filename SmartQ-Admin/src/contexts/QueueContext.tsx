import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type QueueStatus = 'waiting' | 'calling' | 'completed';

export interface Queue {
  id: string;
  queueNumber: number;
  customerName: string;
  status: QueueStatus;
  timestamp: Date;
  counter?: number;
}

interface QueueContextType {
  queues: Queue[];
  currentQueue: Queue | null;
  addQueue: (name: string) => void;
  callNextQueue: () => void;
  callAgain: () => void;
  completeQueue: (id: string) => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

// BroadcastChannel for cross-tab communication
const channel = typeof window !== 'undefined' ? new BroadcastChannel('queue_channel') : null;

export const QueueProvider = ({ children }: { children: ReactNode }) => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);

  // Initialize with mock data
  useEffect(() => {
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
  }, []);

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

  const addQueue = (name: string) => {
    const newQueue: Queue = {
      id: Date.now().toString(),
      queueNumber: queues.length + 1,
      customerName: name,
      status: 'waiting',
      timestamp: new Date(),
    };
    setQueues(prev => [...prev, newQueue]);
  };

  const callNextQueue = () => {
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
      channel?.postMessage({ type: 'CALL_QUEUE', payload: currentQueue });
    }
  };

  const completeQueue = (id: string) => {
    setQueues(prev => prev.map(q => q.id === id ? { ...q, status: 'completed' as QueueStatus } : q));
    if (currentQueue?.id === id) {
      setCurrentQueue(null);
    }
    channel?.postMessage({ type: 'COMPLETE_QUEUE', payload: { id } });
  };

  return (
    <QueueContext.Provider value={{ queues, currentQueue, addQueue, callNextQueue, callAgain, completeQueue }}>
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
