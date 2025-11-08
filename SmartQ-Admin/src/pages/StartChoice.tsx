import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '@/contexts/BackendContext';
import { Card } from '@/components/ui/card';

interface Service {
  name: string;
  label: string;
}

const StartChoice: React.FC = () => {
  const { backendUrl } = useBackend();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!backendUrl) {
      navigate('/setup', { replace: true });
      return;
    }

    const fetchServices = async () => {
      try {
        // services are served under /api/queue/services
        const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/queue/services`);
        const data = await res.json();
        setServices(data);
      } catch (err) {
        console.error('Failed to fetch services', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [backendUrl, navigate]);

  const handleSelectService = (serviceName: string) => {
    navigate('/queue-list', { state: { serviceName } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>กำลังโหลดบริการ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="w-full max-w-4xl text-center">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">เลือกบริการ</h1>
          <Link to="/display">
            <Button variant="outline">ไปที่หน้าจอประกาศ</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((s) => (
            <Card key={s.name} className="p-6 shadow-md flex flex-col justify-between">
              <h2 className="text-xl font-semibold mb-4">{(s as any).label || s.name}</h2>
              <Button onClick={() => handleSelectService(s.name)}>เลือก</Button>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            หากยังไม่ได้ตั้งค่า backend URL, กรุณาไปที่หน้า <Button variant="ghost" size="sm" onClick={() => navigate('/setup')}>ตั้งค่า URL</Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StartChoice;
