import { Link } from 'react-router-dom';
import { useQueue } from '@/contexts/QueueContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Clock, ArrowRight , ArrowLeftFromLine } from 'lucide-react';

const DisplayBoard = () => {
  const { queues, currentQueue } = useQueue();

  // หาคิวถัดไปที่รอเรียก
  const nextQueue = queues.find(q => q.status === 'waiting');

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            ระบบเรียกคิว
          </h1>
          <p className="text-2xl text-muted-foreground">กรุณาติดตามหมายเลขคิวของท่าน</p>
        </div>

        {/* Current Queue Display */}
        <Card className="mb-8 overflow-hidden shadow-elegant border-2">
          <div className="bg-gradient-primary p-6">
            <div className="flex items-center justify-center gap-4">
              <Radio className="w-10 h-10 text-primary-foreground animate-pulse" />
              <h2 className="text-4xl font-bold text-primary-foreground">คิวปัจจุบัน</h2>
            </div>
          </div>
          
          <div className="p-16 text-center bg-gradient-card">
            {currentQueue ? (
              <>
                <div className="mb-8">
                  <p className="text-3xl text-muted-foreground mb-4">หมายเลขคิว</p>
                  <div className="inline-block bg-success/20 rounded-3xl px-16 py-8 border-4 border-success shadow-success">
                    <p className="text-9xl font-bold text-success animate-pulse">
                      {currentQueue.queueNumber}
                    </p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <p className="text-2xl text-muted-foreground mb-2">ชื่อ</p>
                  <p className="text-5xl font-bold">{currentQueue.customerName}</p>
                </div>

                {currentQueue.counter && (
                  <div className="mt-8 pt-8 border-t-2 border-border">
                    <p className="text-2xl text-muted-foreground mb-2">ช่องบริการ</p>
                    <div className="inline-block bg-primary/20 rounded-2xl px-12 py-6 border-2 border-primary">
                      <p className="text-6xl font-bold text-primary">
                        ช่อง {currentQueue.counter}
                      </p>
                    </div>
                  </div>
                )}

                {/* Service label (if provided by server) */}
                {currentQueue.service && (
                  <div className="mt-6">
                    <p className="text-lg text-muted-foreground mb-1">บริการ</p>
                    <p className="text-2xl font-semibold text-primary">{currentQueue.service}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12">
                <Clock className="w-24 h-24 mx-auto mb-6 text-muted-foreground opacity-50" />
                <p className="text-4xl text-muted-foreground">รอเรียกคิวถัดไป...</p>
              </div>
            )}
          </div>
        </Card>

        {/* Next Queue Preview */}
        {nextQueue && (
          <Card className="overflow-hidden shadow-md border-2">
            <div className="bg-secondary p-4">
              <div className="flex items-center justify-center gap-3">
                <ArrowRight className="w-6 h-6" />
                <h2 className="text-2xl font-bold">คิวถัดไป</h2>
              </div>
            </div>
            
            <div className="p-12 text-center bg-card">
                <div className="flex items-center justify-center gap-12">
                <div>
                  <p className="text-xl text-muted-foreground mb-2">หมายเลขคิว</p>
                  <div className="inline-block bg-primary/10 rounded-2xl px-10 py-4 border-2 border-primary/30">
                    <p className="text-5xl font-bold text-primary">
                      {nextQueue.queueNumber}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xl text-muted-foreground mb-2">ชื่อ</p>
                  <p className="text-3xl font-bold">{nextQueue.customerName}</p>
                </div>
                {/* show service for next queue if present */}
                {nextQueue.service && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">บริการ</p>
                    <p className="text-lg font-medium">{nextQueue.service}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Choice Navigator Link */}
        <div className="mt-8 text-center">
          <Link to="/start">
            <Button variant="outline"><ArrowLeftFromLine /> กลับไปเลือกบริการ</Button>
          </Link>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-xl text-muted-foreground">
            กรุณารอที่บริเวณห้องรอ เมื่อถึงคิวของท่านจะมีการประกาศเรียก
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisplayBoard;
