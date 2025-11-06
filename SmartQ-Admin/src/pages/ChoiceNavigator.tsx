import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '@/contexts/BackendContext';

const ChoiceNavigator: React.FC = () => {
  const navigate = useNavigate();
  const { backendUrl } = useBackend();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">ไป-กลับ เลือกโหมด</h1>
          <p className="text-muted-foreground mt-2">เชื่อมต่อกับ: <span className="font-mono">{backendUrl ?? 'ยังไม่ได้กำหนด'}</span></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Button className="w-full p-8" size="lg" onClick={() => navigate('/')}>
            ไปหน้ารายการคิว
          </Button>

          <Button className="w-full p-8" size="lg" variant="secondary" onClick={() => navigate('/display')}>
            ไปหน้าประกาศคิว (จอใหญ่)
          </Button>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>กลับ</Button>
          <Button variant="outline" onClick={() => navigate('/start')}>กลับไปหน้าเริ่มต้น</Button>
        </div>
      </div>
    </div>
  );
};

export default ChoiceNavigator;
