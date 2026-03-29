import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import Layout from '@/components/Layout';
import ServerSync from '@/components/ServerSync';
import LoginPage from '@/pages/LoginPage';
import UploadPage from '@/pages/UploadPage';
import ReviewPage from '@/pages/ReviewPage';
import ControlPanelPage from '@/pages/ControlPanelPage';
import { apiClient } from '@/lib/api';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Check if auth is required and if we have a valid token
    const check = async () => {
      try {
        const res = await apiClient.checkAuth();
        if (!res.data.auth_required) {
          setAuthed(true);
        } else {
          // Try existing token by hitting a protected endpoint
          const token = localStorage.getItem('authToken');
          if (token) {
            try {
              await apiClient.healthCheck();
              // If health doesn't require auth, try state endpoint
              await apiClient.getState();
              setAuthed(true);
            } catch {
              localStorage.removeItem('authToken');
              setAuthed(false);
            }
          }
        }
      } catch {
        // Server unreachable — allow offline access
        setAuthed(true);
      }
      setAuthChecked(true);
    };
    check();
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <TooltipProvider>
        <ServerSync />
        <Layout>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/settings" element={<ControlPanelPage />} />
          </Routes>
        </Layout>
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
