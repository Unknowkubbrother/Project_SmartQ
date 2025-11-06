import React from 'react';
import { Navigate } from 'react-router-dom';

type BackendContextType = {
  backendUrl: string | null;
  setBackendUrl: (url: string | null) => void;
};

const BackendContext = React.createContext<BackendContextType | undefined>(undefined);

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendUrl, setBackendUrl] = React.useState<string | null>(null);
  return (
    <BackendContext.Provider value={{ backendUrl, setBackendUrl }}>
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
