import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-block rounded-full bg-primary/10 p-6 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">SmartQ Admin</h1>
        <p className="text-muted-foreground mt-2">กำลังโหลด…</p>
      </div>
    </div>
  );
};

export default SplashScreen;
