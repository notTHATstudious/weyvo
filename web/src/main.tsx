import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startMonitoring } from './monitoring';
import { registerServiceWorker } from './push';
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
