import { useQueue, QueueStatus } from '@/contexts/QueueContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const QueueList = () => {
  const { queues } = useQueue();

  const getStatusBadge = (status: QueueStatus) => {
    switch (status) {
      case 'waiting':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            รอเรียก
          </Badge>
        );
      case 'calling':
        return (
          <Badge className="bg-success hover:bg-success/90 flex items-center gap-1 shadow-success animate-pulse">
            <Radio className="w-3 h-3" />
            กำลังเรียก
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="w-3 h-3" />
            เสร็จสิ้น
          </Badge>
        );
    }
  };

  const getRowClassName = (status: QueueStatus) => {
    if (status === 'calling') {
      return 'bg-success/10 border-success/50 shadow-success';
    }
    if (status === 'completed') {
      return 'opacity-50';
    }
    return '';
  };

  const waitingCount = queues.filter(q => q.status === 'waiting').length;
  const callingCount = queues.filter(q => q.status === 'calling').length;
  const completedCount = queues.filter(q => q.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            หน้ารายการคิว
          </h1>
          <p className="text-muted-foreground">ระบบจัดการคิวแบบ Realtime</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 bg-gradient-card shadow-md border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">กำลังรอ</p>
                <p className="text-3xl font-bold text-primary">{waitingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card shadow-md border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Radio className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">กำลังเรียก</p>
                <p className="text-3xl font-bold text-success">{callingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card shadow-md border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เสร็จสิ้น</p>
                <p className="text-3xl font-bold">{completedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Queue Table */}
        <Card className="shadow-lg border-border/50 overflow-hidden">
          <div className="bg-gradient-primary p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-primary-foreground" />
                <h2 className="text-2xl font-bold text-primary-foreground">รายการคิวทั้งหมด</h2>
              </div>
              <Link to="/call-queue">
                <Button variant="secondary" size="sm">
                  ไปหน้าเรียกคิว
                </Button>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">หมายเลขคิว</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">ชื่อผู้ใช้</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">สถานะ</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">ช่องบริการ</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queues.map((queue) => (
                  <tr
                    key={queue.id}
                    className={`transition-all duration-300 ${getRowClassName(queue.status)}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">
                            {queue.queueNumber}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{queue.customerName}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(queue.status)}
                    </td>
                    <td className="px-6 py-4">
                      {queue.counter ? (
                        <span className="font-semibold text-primary">ช่อง {queue.counter}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {queue.timestamp.toLocaleTimeString('th-TH', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default QueueList;
