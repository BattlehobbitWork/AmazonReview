import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import Layout from '@/components/Layout';
import ServerSync from '@/components/ServerSync';
import UploadPage from '@/pages/UploadPage';
import ReviewPage from '@/pages/ReviewPage';
import ControlPanelPage from '@/pages/ControlPanelPage';

function App() {
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
