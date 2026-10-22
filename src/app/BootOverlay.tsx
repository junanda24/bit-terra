import { useSyncExternalStore } from 'react';
import { getBootStage, subscribeBootStage } from './bootOverlay';

/**
 * Full-screen boot overlay shown from first paint until the app shell is
 * ready. Dark slate + phosphor amber, stage text exposed via role="status".
 */
export function BootOverlay() {
  const stage = useSyncExternalStore(subscribeBootStage, getBootStage);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--bt-slate)', color: 'var(--bt-bezel)' }}
    >
      <div
        className="text-center text-xl tracking-widest sm:text-2xl"
        style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-amber)' }}
      >
        BIT-TERRA
      </div>
      <div
        className="text-xs tracking-wide"
        style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-mint)' }}
      >
        THE GREAT ROLLBACK
      </div>
      <div role="status" aria-live="polite" className="flex items-center gap-3 text-base">
        <span
          className="inline-block h-3 w-3 animate-pulse"
          style={{ background: 'var(--bt-amber)' }}
          aria-hidden="true"
        />
        <span style={{ fontFamily: '"Pixelify Sans", sans-serif' }}>{stage}</span>
      </div>
    </div>
  );
}

export default BootOverlay;
