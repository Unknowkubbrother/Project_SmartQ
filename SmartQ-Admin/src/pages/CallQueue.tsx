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
  const { backendUrl, operatorId, operatorName } = useBackend();

  const [services, setServices] = useState<Record<string, ServiceInfo> | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [completedCandidates, setCompletedCandidates] = useState<Array<{ Q_number: number; FULLNAME_TH: string; service?: string }>>([]);
  const [selectedCompletedQnum, setSelectedCompletedQnum] = useState<number | null>(null);
  const [allowTransferSelection, setAllowTransferSelection] = useState<boolean>(false);
  const [isSkipping, setIsSkipping] = useState<boolean>(false);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const serviceName = propServiceName || params.get('service') || 'inspect';

  // server-side transfer will mark items as transferred; frontend filters by 'transferred' flag from history

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

  // ฟังก์ชัน wrapper สำหรับเสร็จสิ้น: เรียก complete แล้วเปิด selector ให้เลือกคนที่เสร็จ
  const handleCompleteAndEnableTransfer = async () => {
    if (!currentQueue) return;
    // call complete and wait for server to record completed_by
    try {
      await completeQueue(currentQueue.id);
    } catch (e) {
      console.error('completeQueue error', e);
    }

    // build candidate list: include just-completed first, then history items completed by this operator
  const justCompleted = { Q_number: currentQueue.queueNumber, FULLNAME_TH: currentQueue.customerName, service: currentQueue.service, completed_by: operatorId, completed_by_name: operatorName };
  // prefer server history entries that were completed by this operator
  const operatorHistory = (history || []).filter((h: any) => h.completed_by === operatorId);
    const mergedRaw = [justCompleted, ...operatorHistory].filter((v: any, i: number, a: any[]) => a.findIndex(x => x.Q_number === v.Q_number) === i);
    const merged = mergedRaw.filter((x: any) => !x.transferred);
    setCompletedCandidates(merged);
    setSelectedCompletedQnum(merged[0]?.Q_number ?? null);
    setAllowTransferSelection(merged.length > 0);
  };

  // ถ้ากลับมาหน้านี้ใหม่ ให้เติม completedCandidates จาก history (เพื่อให้ selector ยังคงใช้งานได้)
  // จะเติมเฉพาะเมื่อยังไม่มี completedCandidates อยู่แล้ว แต่มี history จากเซิร์ฟเวอร์
  useEffect(() => {
    try {
      if ((!completedCandidates || completedCandidates.length === 0) && history && history.length > 0) {
        // history items are in the shape { Q_number, FULLNAME_TH, ... }
        const filtered = (history as any[]).filter((h: any) => !(h as any).transferred && h.completed_by === operatorId);
        setCompletedCandidates(filtered);
        // เปิดการเลือกถ้ามีรายการใน history เพราะผู้ปฏิบัติงานอาจคลิกเสร็จแล้วก่อนออกไป
        setAllowTransferSelection(filtered.length > 0);
        // preselect the most recent history item
        setSelectedCompletedQnum(filtered[0]?.Q_number ?? null);
      }
    } catch (e) {
      console.error('Failed to restore completed candidates from history', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // ส่งต่อบริการ: เอารายชื่อที่เลือก (จากรายการคนที่เสร็จแล้ว) ไป enqueue ที่บริการเป้าหมาย
  const handleTransfer = async () => {
    if (!transferTarget) return alert('กรุณาเลือกบริการเป้าหมาย');
    if (!selectedCompletedQnum) return alert('กรุณาเลือกผู้ใช้ที่เสร็จแล้วเพื่อส่งต่อ');
    const item = completedCandidates.find(c => c.Q_number === selectedCompletedQnum);
    if (!item) return alert('ไม่พบรายการที่เลือก');

    try {
      const base = backendUrl ? backendUrl.replace(/\/$/, '') : '';
      // call server-side transfer endpoint on the source service
      const endpoint = `${base}/api/queue/${serviceName}/transfer`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Q_number: item.Q_number, target_service: transferTarget }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        throw new Error(j?.error || 'transfer failed');
      }

      // optimistically remove from local candidates; server will broadcast history update via WS
      setCompletedCandidates(prev => prev.filter(c => c.Q_number !== selectedCompletedQnum));
      setSelectedCompletedQnum(null);
      setTransferTarget(null);
      setAllowTransferSelection(false);
    } catch (e) {
      console.error('Failed to transfer', e);
      alert('ส่งต่อไม่สำเร็จ โปรดลองอีกครั้ง');
    }
  };

  // ข้ามคิว: เอาผู้ใช้ปัจจุบันไปต่อท้ายคิว (enqueue) แล้วทำการ complete คิวปัจจุบัน
  const handleSkip = async () => {
    if (!currentQueue) return alert('ไม่มีคิวที่กำลังเรียกเพื่อข้าม');
    if (!backendUrl) return alert('ยังไม่ได้ตั้งค่า backend URL');
    setIsSkipping(true);
    try {
      const base = backendUrl.replace(/\/$/, '');
      // 1) enqueue the same person to the same service -> goes to back of queue
      await fetch(`${base}/api/queue/${serviceName}/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FULLNAME_TH: currentQueue.customerName }),
      });

      // 2) complete the current queue item so it's removed from current
      await fetch(`${base}/api/queue/${serviceName}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Q_number: currentQueue.queueNumber, FULLNAME_TH: currentQueue.customerName, service: serviceName }),
      });

      // reset local transfer-selection state (if any)
      setAllowTransferSelection(false);
      setCompletedCandidates(prev => prev.filter(c => c.Q_number !== currentQueue.queueNumber));

      alert('ข้ามคิวเรียบร้อยแล้ว ผู้ใช้ถูกนำไปต่อท้ายคิว');
    } catch (e) {
      console.error('Skip failed', e);
      alert('ไม่สามารถข้ามคิวได้ กรุณาลองอีกครั้ง');
    }
    setIsSkipping(false);
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
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            onClick={handleCompleteAndEnableTransfer}
            disabled={!currentQueue}
            variant="secondary"
            size="lg"
            className="h-20 text-lg font-semibold shadow-sm"
          >
            <CheckCircle className="w-6 h-6 mr-2" />
            เสร็จสิ้น
          </Button>

          <Button
            onClick={handleSkip}
            disabled={!currentQueue || isSkipping}
            variant="ghost"
            size="lg"
            className="h-20 text-lg font-semibold shadow-sm"
          >
            ข้ามคิว
          </Button>
        </div>

        {/* Transfer to another service (requires completing a user first) */}
        <Card className="mb-6 p-4">
          <h3 className="font-semibold mb-2">ส่งต่อผู้ใช้ไปยังบริการอื่น</h3>
          <div className="flex flex-col gap-3">
            <div className="text-sm text-muted-foreground">ก่อนส่งต่อ ให้กด "เสร็จสิ้น" สำหรับคิวที่ต้องการก่อน จากนั้นเลือกรายชื่อจากรายการผู้ที่เสร็จแล้ว</div>

            <div className="flex items-center gap-3">
              <select
                className="px-3 py-2 border rounded"
                value={selectedCompletedQnum ?? ''}
                onChange={(e) => setSelectedCompletedQnum(e.target.value ? Number(e.target.value) : null)}
                disabled={!allowTransferSelection}
              >
                <option value="">-- เลือกรายชื่อผู้ที่เสร็จแล้ว --</option>
                {completedCandidates.map(c => (
                  <option key={c.Q_number} value={c.Q_number}>
                    {c.Q_number} — {c.FULLNAME_TH}{(c as any).completed_by_name ? ` (โดย ${(c as any).completed_by_name})` : ''}
                  </option>
                ))}
              </select>

              <select
                className="px-3 py-2 border rounded"
                value={transferTarget ?? ''}
                onChange={(e) => setTransferTarget(e.target.value || null)}
              >
                <option value="">-- เลือกบริการปลายทาง --</option>
                {services && Object.keys(services).map(key => (
                  key === serviceName ? null : (
                    <option key={key} value={key}>{(services as any)[key].name || key}</option>
                  )
                ))}
              </select>

              <Button onClick={handleTransfer} disabled={!allowTransferSelection || !transferTarget || !selectedCompletedQnum}>
                ส่งต่อไปยังบริการอื่น
              </Button>
            </div>
          </div>
        </Card>

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
