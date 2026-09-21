import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAppStore } from './stores/appStore';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Toast from './components/Toast';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewScrape = lazy(() => import('./pages/NewScrape'));
const Queue = lazy(() => import('./pages/Queue'));
const Projects = lazy(() => import('./pages/Projects'));
const Library = lazy(() => import('./pages/Library'));
const EPUBBuilder = lazy(() => import('./pages/EPUBBuilder'));
const EPUBReader = lazy(() => import('./pages/EPUBReader'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));

function PageLoader() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="flex flex-col items-center gap-4">
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span className="text-sm text-tertiary">Loading...</span>
      </div>
    </div>
  );
}

function AppLayout() {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <main className="app-main">
        <Navbar />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scrape" element={<NewScrape />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/library" element={<Library />} />
            <Route path="/epub-builder" element={<EPUBBuilder />} />
            <Route path="/epub-reader" element={<EPUBReader />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
      <SpeedInsights />
    </BrowserRouter>
  );
}
