import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { logError } from './app/errorLog';

// Self-healing: errors that escape React (async handlers, promises) still
// land in the local error log instead of vanishing (BLUEPRINT §7).
window.addEventListener('error', (event) => {
  logError(event.error ?? new Error(event.message), 'window');
});
window.addEventListener('unhandledrejection', (event) => {
  logError(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    'promise',
  );
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
