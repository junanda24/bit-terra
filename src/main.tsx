import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { logError } from './app/errorLog';
import { handleChunkLoadFailure } from './app/chunkReload';

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

// Self-healing: a lazy chunk (the quest index loads this way) can go stale
// after a redeploy. Vite fires vite:preloadError — reload at most once per
// 60s window instead of leaving a dead button (BLUEPRINT §7).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  handleChunkLoadFailure('vite:preloadError');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Tells the inline guard in index.html that the entry bundle arrived and
// executed — if this never runs, the guard assumes a stale chunk and
// reloads at most once.
(window as unknown as { __BITTERRA_BOOTED__?: boolean }).__BITTERRA_BOOTED__ = true;
