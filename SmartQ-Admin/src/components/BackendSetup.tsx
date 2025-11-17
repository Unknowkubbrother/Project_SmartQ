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
    const { backendUrl, setBackendUrl, setOperatorName ,setInitalData } = useBackend();
    const [url, setUrl] = useState<string>('');
    const [operatorName, setLocalOperatorName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectedUrl, setConnectedUrl] = useState<string | null>(null);
    const [usernames, setUsernames] = useState<string[]>([]);
    const [jhcisSupported, setJHCISSupported] = useState<boolean>(false);
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loggedIn, setLoggedIn] = useState<boolean>(false);
    const [displayName, setDisplayName] = useState<string>('');
    const navigate = useNavigate();

    const onConnect = async () => {
        setError(null);
        // If already connected but backend doesn't support jhcis, finalize by registering operatorName
        if (connectedUrl && !jhcisSupported) {
            // finalize manual operator name registration and navigate
            if (!operatorName) {
                setError('กรุณากรอกชื่อผู้ปฏิบัติงานก่อนดำเนินการ');
                return;
            }
            try {
                const base = connectedUrl.replace(/\/$/, '');
                const opId = (window.sessionStorage.getItem('operatorId') as string) || '';
                if (opId) {
                    await fetch(base + '/api/operator/register', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ operatorId: opId, name: operatorName }),
                    });
                }
                sessionStorage.setItem('operatorName', operatorName);
                setOperatorName && setOperatorName(operatorName);
                navigate('/start', { replace: true });
                return;
            } catch (e) {
                console.warn('operator register failed', e);
                setError('ไม่สามารถบันทึกชื่อพนักงานได้');
                return;
            }
        }

        setLoading(true);
        const result = await tryConnect(url);
        setLoading(false);
        if (result.ok) {
            // Set in-memory backend URL for this session only but wait for login before navigating
            setBackendUrl(result.url);
            setConnectedUrl(result.url);
            // try fetch usernames for login (if backend supports jhcis)
            try {
                const res = await fetch(result.url.replace(/\/$/, '') + '/api/jhcis/usernames');
                if (res.ok) {
                    const list = await res.json();
                    setUsernames(Array.isArray(list) ? list : (list.users || []));
                    setJHCISSupported(true);


                    const initialRes = await fetch(result.url.replace(/\/$/, '') + '/api/initial');
                    if (initialRes.ok) {
                        const initialData = await initialRes.json();
                        setInitalData(initialData);
                    }
                    
                } else {
                    setJHCISSupported(false);
                }
            } catch (e) {
                // backend might not expose jhcis endpoints — allow manual operator name entry
                setJHCISSupported(false);
            }
        } else {
            setError('ไม่สามารถเชื่อมต่อได้: ' + (result as any).error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
            <div className="w-full max-w-xl">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">ตั้งค่า Server</h1>
                    <p className="text-muted-foreground mt-1">กรุณาใส่ URL ของ server ของคุณ (เช่น http://192.168.0.158:8000)</p>
                </div>

                <div className="bg-card rounded-lg p-6 shadow-md">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Server URL</label>
                        <Input value={url} onChange={(e) => setUrl((e.target as HTMLInputElement).value)} placeholder="http://192.168.0.158:8000" />
                    </div>

                    {/* If connectedUrl is set, require login first (preferred) then allow operatorName registration */}
                    {connectedUrl && jhcisSupported && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">เข้าสู่ระบบ</label>
                            {usernames && usernames.length > 0 ? (
                                <select className="w-full border px-3 py-2 rounded mb-2" value={username} onChange={(e) => setUsername(e.target.value)}>
                                    <option value="">-- เลือกชื่อผู้ใช้งาน --</option>
                                    {usernames.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            ) : (
                                <Input value={username} onChange={(e) => setUsername((e.target as HTMLInputElement).value)} placeholder="ชื่อผู้ใช้" className="mb-2" />
                            )}

                            <Input type="password" value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} placeholder="รหัสผ่าน" className="mb-2" />
                            {loginError && <p className="text-sm text-destructive mb-2">{loginError}</p>}
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" onClick={() => {
                                    // cancel connection and reset
                                    setConnectedUrl(null);
                                    setBackendUrl(null);
                                    setUsernames([]);
                                }}>ยกเลิก</Button>
                                <Button onClick={async () => {
                                    setLoginError(null);
                                    if (!connectedUrl) return setLoginError('ยังไม่ได้เชื่อมต่อ backend');
                                    if (!username || !password) return setLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
                                    try {
                                        const res = await fetch(connectedUrl.replace(/\/$/, '') + '/api/jhcis/login', {
                                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ username, password }),
                                        });
                                        const j = await res.json().catch(() => ({}));
                                        if (!res.ok) {
                                            setLoginError(j?.message || 'ไม่สามารถเข้าสู่ระบบได้');
                                            return;
                                        }
                                        // login ok -> automatically use username as display name
                                        const opName = username;
                                        const opId = (window.sessionStorage.getItem('operatorId') as string) || '';
                                        if (opId) {
                                            try {
                                                await fetch(connectedUrl.replace(/\/$/, '') + '/api/operator/register', {
                                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ operatorId: opId, name: opName }),
                                                });
                                            } catch (e) {
                                                console.warn('operator register failed', e);
                                            }
                                        }
                                        sessionStorage.setItem('operatorName', opName);
                                        setOperatorName && setOperatorName(opName);
                                        // navigate to start
                                        navigate('/start', { replace: true });
                                    } catch (e) {
                                        console.error('login error', e);
                                        setLoginError('เกิดข้อผิดพลาดระหว่างการเชื่อมต่อ');
                                    }
                                }}>เข้าสู่ระบบ</Button>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive mb-4">{error}</p>}

                    {!backendUrl && (
                        <div className="flex gap-2 justify-end">
                            <Button variant="secondary" onClick={() => { setUrl(''); setBackendUrl(null); }}>
                                ล้าง
                            </Button>
                            <Button onClick={onConnect} disabled={loading || !url}>
                                {loading ? 'กำลังเชื่อมต่อ…' : 'เชื่อมต่อ'}
                            </Button>
                        </div>
                    )

                    }
                </div>
            </div>
        </div>
    );
};

export default BackendSetup;
