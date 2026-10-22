import { useEffect, useRef, useState } from 'react';
import { NineSlicePanel } from '../design-system/NineSlicePanel';

export interface DialogueBoxProps {
  /** Nama NPC yang berbicara (plat nama di sudut panel). */
  name: string;
  text: string;
  /** Kecepatan ketik per karakter (ms). */
  speedMs?: number;
  onFinished?: () => void;
}

/**
 * Kotak dialog NPC dengan efek typewriter. Klik kotak = tampilkan seluruh
 * teks seketika (pemain yang cepat membaca tidak perlu menunggu).
 */
export function DialogueBox({ name, text, speedMs = 16, onFinished }: DialogueBoxProps) {
  const [shown, setShown] = useState(0);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    setShown(0);
    finishedRef.current = false;
    if (!text) return;
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, speedMs]);

  useEffect(() => {
    if (shown >= text.length && text.length > 0 && !finishedRef.current) {
      finishedRef.current = true;
      onFinishedRef.current?.();
    }
  }, [shown, text]);

  const done = shown >= text.length;

  return (
    <div className="relative pt-3">
      <div
        className="absolute left-4 top-0 z-10 rounded-[3px] px-2.5 py-0.5 text-[13px] font-bold uppercase tracking-[0.14em]"
        style={{
          fontFamily: "'Pixelify Sans', sans-serif",
          backgroundColor: '#f4b41b',
          color: '#141820',
          border: '2px solid rgba(0,0,0,0.55)',
          boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
        }}
      >
        {name}
      </div>
      <NineSlicePanel variant="slate">
        <button
          type="button"
          onClick={() => setShown(text.length)}
          className="block min-h-[64px] w-full cursor-pointer px-4 py-3 text-left"
          aria-label={`Dialog ${name}`}
        >
          <span
            className="text-[16px] leading-relaxed"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#f2ead6' }}
          >
            {text.slice(0, shown)}
          </span>
          <span
            aria-hidden
            className="ml-1 inline-block animate-pulse"
            style={{ color: '#ffb000' }}
          >
            {done ? '▾' : '…'}
          </span>
        </button>
      </NineSlicePanel>
    </div>
  );
}

export default DialogueBox;
