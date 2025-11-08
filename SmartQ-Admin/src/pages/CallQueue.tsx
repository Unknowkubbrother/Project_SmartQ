import { useQueue } from '@/contexts/QueueContext';
import { useBackend } from '@/contexts/BackendContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, RotateCcw, User, Hash, CheckCircle, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

interface ServiceInfo {
  name: string;
  counters: { name: string; code: string }[];
}

const CallQueue = ({ serviceName: propServiceName }: { serviceName?: string } = {}) => {
  const { currentQueue, callNextQueue, callAgain, completeQueue, serverStatus, setMute, history } = useQueue();
  const { backendUrl } = useBackend();

  const [services, setServices] = useState<Record<string, ServiceInfo> | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const serviceName = propServiceName || params.get('service') || 'inspect';

  // ดึงข้อมูลบริการและ counter จาก backend
  useEffect(() => {
    if (!backendUrl) return;
    const fetchServices = async () => {
      try {
        // services endpoint is under /api/queue/services
        const res = await fetch(backendUrl.replace(/\/$/, '') + '/api/queue/services');
        if (res.ok) {
          const data = await res.json();
          const serviceMap: Record<string, ServiceInfo> = {};
          data.forEach((s: any) => serviceMap[s.name] = s);
          setServices(serviceMap);
          if (serviceMap[serviceName] && serviceMap[serviceName].counters.length > 0) {
            setSelectedCounter(serviceMap[serviceName].counters[0].code);
          }
        }
      } catch (e) {
        console.error('Failed to fetch services', e);
      }
    };
    fetchServices();
  }, [backendUrl, serviceName]);

  // เรียกคิวถัดไป พร้อมส่ง counter
  const handleCallNext = async () => {
    if (!selectedCounter) return alert('กรุณาเลือกช่องบริการก่อนเรียกคิว');

    // ส่ง counter ผ่าน context callNextQueue
    if (callNextQueue) await callNextQueue(selectedCounter);
  };

  const handleCallAgain = async () => {
    if (callAgain) await callAgain();
  };

  const toggleMute = async () => {
    if (!setMute || !serverStatus) return;
    await setMute(!serverStatus.muted);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            หน้าเรียกคิว
          </h1>
          <div className="flex items-center justify-center gap-4">
            <p className="text-muted-foreground">บริการ: {serviceName}</p>
            <Link to="/display" state={{ serviceName }}>
              <Button variant="outline" size="sm">ไปที่หน้าจอประกาศ</Button>
            </Link>
          </div>
        </div>

        {/* Counter Selection */}
        {services && services[serviceName] && (
          <Card className="mb-6 p-4">
            <h3 className="font-semibold mb-2">เลือกช่องบริการ</h3>
            <div className="flex flex-wrap gap-2">
              {services[serviceName].counters.map(c => (
                <Button
                  key={c.code}
                  size="sm"
                  variant={selectedCounter === c.code ? 'default' : 'outline'}
                  onClick={() => setSelectedCounter(c.code)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Current Queue */}
        <Card className="p-8 shadow-lg border-border/50 bg-gradient-card mb-6">
          <div className="text-center mb-6">
            <Badge variant="secondary" className="mb-4">
              <PhoneCall className="w-4 h-4 mr-1" />
              คิวปัจจุบัน
            </Badge>
          </div>

          {currentQueue ? (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-primary shadow-glow mb-3">
                    <span className="text-5xl font-bold text-primary-foreground">
                      {currentQueue.queueNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Hash className="w-4 h-4" />
                    <span className="text-sm">หมายเลขคิว</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-muted-foreground">ชื่อผู้รับบริการ</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{currentQueue.customerName}</p>
              </div>

              {/* แสดง counter ของคิวปัจจุบัน */}
              {currentQueue.counter && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 rounded-lg">
                    <span className="text-muted-foreground">ช่องบริการ</span>
                    <span className="text-2xl font-bold text-primary">{currentQueue.counter}</span>
                  </div>
                </div>
              )}

              {currentQueue.service && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 rounded-lg">
                    <span className="text-muted-foreground">บริการ</span>
                    <span className="text-2xl font-bold text-primary">{currentQueue.service}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <PhoneCall className="w-12 h-12 text-muted-foreground" />
              </div>
              <p className="text-xl text-muted-foreground">ไม่มีคิวที่กำลังเรียก</p>
              <p className="text-sm text-muted-foreground mt-2">กดปุ่ม "เรียกคิวถัดไป" เพื่อเริ่มเรียกคิว</p>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            onClick={handleCallNext}
            size="lg"
            className="h-20 text-lg font-semibold shadow-md hover:shadow-glow transition-all"
            disabled={!selectedCounter}
          >
            <PhoneCall className="w-6 h-6 mr-2" />
            เรียกคิวถัดไป
          </Button>

          <Button
            onClick={handleCallAgain}
            disabled={!currentQueue}
            variant="outline"
            size="lg"
            className="h-20 text-lg font-semibold shadow-sm"
          >
            <RotateCcw className="w-6 h-6 mr-2" />
            เรียกซ้ำ
          </Button>

          <Button
            onClick={() => currentQueue && completeQueue(currentQueue.id)}
            disabled={!currentQueue}
            variant="secondary"
            size="lg"
            className="h-20 text-lg font-semibold shadow-sm"
          >
            <CheckCircle className="w-6 h-6 mr-2" />
            เสร็จสิ้น
          </Button>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost">← กลับหน้ารายการคิว</Button>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleMute}>
              {serverStatus?.muted ? (
                <>
                  <VolumeX className="w-4 h-4 mr-2" /> ปิดเสียง
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" /> เสียงเปิด
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallQueue;
