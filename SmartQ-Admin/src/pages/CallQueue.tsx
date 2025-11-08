import { useQueue } from '@/contexts/QueueContext';
import { useBackend } from '@/contexts/BackendContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, RotateCcw, User, Hash, CheckCircle, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CallQueue = () => {
  const { currentQueue, callNextQueue, callAgain, completeQueue, serverStatus, setMute, history } = useQueue();
  const { backendUrl } = useBackend();
  const [services, setServices] = useState<Record<string, string> | null>(null);
  
  useEffect(() => {
    if (!backendUrl) return;
    const fetchServices = async () => {
      try {
        const res = await fetch(backendUrl.replace(/\/$/, '') + '/api/services');
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (e) {
        console.error('Failed to fetch services', e);
      }
    };
    fetchServices();
  }, [backendUrl]);
  const speaking = false;

  const handleCallNext = () => {
    callNextQueue();
  };

  const handleCallAgain = () => {
    // Re-announce handled locally via BroadcastChannel; server has no re-announce endpoint
    callAgain();
  };

  const handleComplete = () => {
    if (currentQueue) {
      completeQueue(currentQueue.id);
    }
  };

  const handleStopSpeech = () => {
    // nothing to stop locally; server audio is played only on display
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
          <p className="text-muted-foreground">ช่องบริการ 1</p>
        </div>

        <div className="grid gap-6">
          {/* Current Queue Display */}
          <Card className="p-8 shadow-lg border-border/50 bg-gradient-card">
            <div className="text-center mb-6">
              <Badge variant="secondary" className="mb-4">
                <PhoneCall className="w-4 h-4 mr-1" />
                คิวปัจจุบัน
              </Badge>
            </div>

        {currentQueue ? (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-8">
                  {/* Queue Number */}
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

                {/* Customer Name */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <User className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">ชื่อผู้รับบริการ</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{currentQueue.customerName}</p>
                </div>

                {/* Counter */}
                {currentQueue.service && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 rounded-lg">
                    <span className="text-muted-foreground">บริการ</span>
                    <span className="text-2xl font-bold text-primary">{currentQueue.service}</span>
                  </div>
                </div>
              )}

                {/* Speaking Indicator */}
                {speaking && (
                  <div className="flex items-center justify-center gap-2 text-success animate-pulse">
                    <Volume2 className="w-5 h-5" />
                    <span className="font-medium">กำลังประกาศ...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <PhoneCall className="w-12 h-12 text-muted-foreground" />
                </div>
                <p className="text-xl text-muted-foreground">ไม่มีคิูที่กำลังเรียก</p>
                <p className="text-sm text-muted-foreground mt-2">กดปุ่ม "เรียกคิวถัดไป" เพื่อเริ่มเรียกคิว</p>
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleCallNext}
              size="lg"
              className="h-20 text-lg font-semibold shadow-md hover:shadow-glow transition-all"
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
              onClick={handleComplete}
              disabled={!currentQueue}
              variant="secondary"
              size="lg"
              className="h-20 text-lg font-semibold shadow-sm"
            >
              <CheckCircle className="w-6 h-6 mr-2" />
              เสร็จสิ้น
            </Button>
          </div>

          {/* Additional Controls */}
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost">
                ← กลับหน้ารายการคิว
              </Button>
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

          {/* Available services from backend */}
          {services && Object.keys(services).length > 0 && (
            <Card className="mt-6 p-4">
              <h3 className="font-semibold mb-2">บริการที่มี</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(services).map(([key, label]) => (
                  <Badge key={key} className="px-3 py-1" variant="outline">{label}</Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Recent history from server */}
          {history && history.length > 0 && (
            <Card className="mt-6 p-4">
              <h3 className="font-semibold mb-2">ประวัติการเรียก (ล่าสุด)</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {history.slice(0, 6).map((h) => (
                  <li key={h.Q_number}>{h.Q_number} — {h.FULLNAME_TH} — {h.service}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallQueue;
