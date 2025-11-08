import React from 'react';
import { Navigate } from 'react-router-dom';

type BackendContextType = {
  backendUrl: string | null;
  setBackendUrl: (url: string | null) => void;
  operatorId: string;
  operatorName?: string | null;
  setOperatorName?: (name: string | null) => void;
};

const BackendContext = React.createContext<BackendContextType | undefined>(undefined);

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendUrl, setBackendUrl] = React.useState<string | null>(null);
  // per-operator id stored in session so we can identify who completed items
  const [operatorId, setOperatorId] = React.useState<string>(() => {
    try {
      const existing = sessionStorage.getItem('operatorId');
      if (existing) return existing;
      const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `op-${Date.now()}-${Math.floor(Math.random()*10000)}`;
      sessionStorage.setItem('operatorId', id);
      return id;
    } catch (e) {
      return `op-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    }
  });
  const [operatorName, setOperatorName] = React.useState<string | null>(() => {
    try {
      return sessionStorage.getItem('operatorName');
    } catch (e) {
      return null;
    }
  });
  return (
    <BackendContext.Provider value={{ backendUrl, setBackendUrl, operatorId, operatorName, setOperatorName }}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => {
  const ctx = React.useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used within BackendProvider');
  return ctx;
};

// Component to require backend to be set for route children
export const RequireBackend: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { backendUrl } = useBackend();
  if (!backendUrl) return <Navigate to="/setup" replace />;
  return children;
};

export default BackendContext;
