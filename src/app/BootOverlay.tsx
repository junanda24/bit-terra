import { useSyncExternalStore } from 'react';
import { getBootError, getBootStage, subscribeBootStage } from './bootOverlay';

/**
 * Full-screen boot overlay shown from first paint until the app shell is
 * ready. Dark slate + phosphor amber, stage text exposed via role="status".
 * If boot failed, it switches to an honest error state with a reload
 * button instead of spinning forever (self-healing, BLUEPRINT §7).
 */
export function BootOverlay() {
  const stage = useSyncExternalStore(subscribeBootStage, getBootStage);
  const bootError = useSyncExternalStore(subscribeBootStage, getBootError);

  if (bootError) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-4"
        style={{ background: 'var(--bt-slate)', color: 'var(--bt-bezel)' }}
      >
        <div
          className="text-center text-xl tracking-widest sm:text-2xl"
          style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-amber)' }}
        >
          BIT-TERRA
        </div>
        <div
          role="alert"
          className="w-full max-w-md border-4 p-5 text-center"
          style={{ borderColor: 'var(--bt-coral)', background: '#1b2230' }}
        >
          <p
            className="mb-2 text-base"
            style={{ fontFamily: '"Pixelify Sans", sans-serif' }}
          >
            Bit-Terra gagal dimuat. Piko sudah mencatat masalahnya di log error.
          </p>
          <p
            className="mb-4 break-words text-xs"
            style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--bt-coral)' }}
          >
            {bootError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border-2 px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: 'var(--bt-amber)',
              background: 'var(--bt-amber)',
              color: 'var(--bt-slate)',
              fontFamily: '"Pixelify Sans", sans-serif',
            }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

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
