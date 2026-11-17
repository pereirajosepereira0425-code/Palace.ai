import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { bindServiceWorkerUpdater } from './utils/appVersion.ts';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      bindServiceWorkerUpdater({ updateSW, needRefresh: true });
    },
    onOfflineReady() {
      bindServiceWorkerUpdater({ updateSW, offlineReady: true });
    },
    onRegisteredSW(_swUrl, registration) {
      bindServiceWorkerUpdater({ registration: registration || null, updateSW });
    },
  });
  bindServiceWorkerUpdater({ updateSW });
}

createRoot(document.getElementById('root')!).render(<App />);
