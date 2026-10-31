import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startMonitoring } from './monitoring';
import { registerServiceWorker } from './push';

// The website allows pinch-zoom (people with low vision rely on it). The installed home-screen app
// turns it off so it feels like an app; the phone's own Zoom setting still works there.
const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
if (installed) {
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

startMonitoring();
registerServiceWorker();
