import React from 'react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useBackend } from '@/contexts/BackendContext';

const StartChoice: React.FC = () => {
  const { backendUrl } = useBackend();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!backendUrl) navigate('/setup', { replace: true });
  }, [backendUrl, navigate]);

  const displayBackend = backendUrl ?? 'ยังไม่ได้กำหนด';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">พร้อมเชื่อมต่อ</h1>
          <p className="text-muted-foreground mt-2">เชื่อมต่อกับ: <span className="font-mono">{displayBackend}</span></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/">
            <Button className="w-full p-8" size="lg">
              ไปหน้ารายการคิว
            </Button>
          </Link>

          <Link to="/display">
            <Button className="w-full p-8" variant="secondary" size="lg">
              ไปหน้าประกาศคิว (จอใหญ่)
            </Button>
          </Link>
        </div>

        <div className="mt-6">
          <Link to="/setup">
            <Button variant="ghost">เปลี่ยน URL</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StartChoice;
