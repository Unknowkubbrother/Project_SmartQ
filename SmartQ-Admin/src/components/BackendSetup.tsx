import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '@/contexts/BackendContext';

const tryConnect = async (url: string, timeout = 4000) => {
  // Ensure url has protocol
  let final = url;
  if (!/^https?:\/\//i.test(final)) final = `http://${final}`;

  // small fetch with timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(final, { method: 'GET', signal: controller.signal });
    clearTimeout(id);
    // accept any 2xx/3xx/4xx as reachable; network errors will throw
    return { ok: true, url: final };
  } catch (err) {
    clearTimeout(id);
    return { ok: false, error: (err as Error).message };
  }
};

const BackendSetup: React.FC = () => {
  const { setBackendUrl, setOperatorName } = useBackend();
  const [url, setUrl] = useState<string>('');
  const [operatorName, setLocalOperatorName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onConnect = async () => {
    setError(null);
    setLoading(true);
    const result = await tryConnect(url);
    setLoading(false);
    if (result.ok) {
      // Set in-memory backend URL for this session only
      setBackendUrl(result.url);
      try {
        // register operator name on server so others see it
        const opId = (window.sessionStorage.getItem('operatorId') as string) || '';
        if (opId && operatorName) {
          await fetch(result.url.replace(/\/$/, '') + '/api/operator/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operatorId: opId, name: operatorName }),
          });
          // persist locally and in context
          sessionStorage.setItem('operatorName', operatorName);
          setOperatorName && setOperatorName(operatorName);
        }
      } catch (e) {
        console.warn('operator register failed', e);
      }
      navigate('/start', { replace: true });
    } else {
      setError('ไม่สามารถเชื่อมต่อได้: ' + (result as any).error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">ตั้งค่า Backend</h1>
          <p className="text-muted-foreground mt-1">กรุณาใส่ URL ของ backend ของคุณ (เช่น http://localhost:8000)</p>
        </div>

        <div className="bg-card rounded-lg p-6 shadow-md">
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Backend URL</label>
            <Input value={url} onChange={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="http://localhost:8000" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">ชื่อผู้ปฏิบัติงาน (จะแสดงให้ผู้อื่นเห็น)</label>
            <Input value={operatorName} onChange={(e) => setLocalOperatorName((e.target as HTMLInputElement).value)} placeholder="เช่น พนักงาน A" />
          </div>

          {error && <p className="text-sm text-destructive mb-4">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setUrl(''); setBackendUrl(null); }}>
              ล้าง
            </Button>
            <Button onClick={onConnect} disabled={loading || !url}>
              {loading ? 'กำลังเชื่อมต่อ…' : 'เชื่อมต่อ'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackendSetup;
