import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CRTScanlineOverlay } from '../design-system/CRTScanlineOverlay';
import { useGameStore } from '../../core/bridge/gameStore';
import { SoundController } from '../../core/audio/SoundController';

export type LampState = 'ready' | 'error' | 'running';

export interface DeckSticker {
  label: string;
  color: string;
}

const LAMP: Record<LampState, { color: string; glow: string; text: string }> = {
  ready: { color: '#3ddc68', glow: '0 0 14px 3px rgba(61,220,104,0.8)', text: 'SIAP' },
  error: { color: '#ffb000', glow: '0 0 10px 2px rgba(255,176,0,0.55)', text: 'PERIKSA' },
  running: { color: '#00f5d4', glow: '0 0 12px 3px rgba(0,245,212,0.7)', text: 'BERJALAN' },
};

function BezelScrew({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 h-[13px] w-[13px] rounded-full ${className}`}
      style={{
        background: 'radial-gradient(circle at 35% 30%, #fdf6e0 0%, #a99c80 50%, #57503f 100%)',
        boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.65), 0 1px 1px rgba(0,0,0,0.4)',
      }}
    >
      <span
        className="absolute left-1/2 top-1/2 block h-[1.5px] w-[8px] bg-[#3d372b]"
        style={{ transform: 'translate(-50%,-50%) rotate(-24deg)' }}
      />
    </span>
  );
}

export interface CyberDeckFrameProps {
  title: string;
  lampState: LampState;
  /** Stiker hadiah quest yang menempel di bezel. */
  stickers?: DeckSticker[];
  /** Isi rel kanan (biasanya <RunLever />). */
  rightRail?: ReactNode;
  children: ReactNode;
}

/**
 * Bingkai fisik Cyber-Deck milik kakek: bezel krem retro, slot stiker,
 * lampu READY, layar slate dengan kaca CRT. Membuka deck = dunia PAUSE +
 * musik masuk mode ngoding; menutup = dunia jalan lagi (store.setCodingMode
 * menembakkan WORLD_PAUSE / WORLD_RESUME ke eventBus).
 */
export function CyberDeckFrame({
  title,
  lampState,
  stickers = [],
  rightRail,
  children,
}: CyberDeckFrameProps) {
  useEffect(() => {
    useGameStore.getState().setCodingMode(true);
    try {
      SoundController.setCodingMode(true);
    } catch {
      // Engine audio belum menyala — deck tetap bisa dipakai.
    }
    return () => {
      useGameStore.getState().setCodingMode(false);
      try {
        SoundController.setCodingMode(false);
      } catch {
        // Sama seperti di atas: diamkan.
      }
    };
  }, []);

  const lamp = LAMP[lampState];

  return (
    <div
      className="relative rounded-[14px] p-3"
      style={{
        background: 'linear-gradient(160deg, #e6dcc4 0%, #d8ccb8 55%, #c9bb9e 100%)',
        border: '3px solid #8a7c62',
        boxShadow:
          '0 10px 0 rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.65), inset 0 -4px 0 rgba(0,0,0,0.18)',
      }}
    >
      <BezelScrew className="left-2 top-2" />
      <BezelScrew className="right-2 top-2" />
      <BezelScrew className="bottom-2 left-2" />
      <BezelScrew className="bottom-2 right-2" />

      {/* Bar atas: plat judul + slot stiker + lampu */}
      <div className="mb-2.5 flex items-center gap-3 px-1.5">
        <div
          className="rounded-[4px] px-3 py-1.5"
          style={{
            backgroundColor: '#141820',
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          <span
            className="text-[10.5px] tracking-[0.14em]"
            style={{ fontFamily: "'Press Start 2P', monospace", color: '#ffb000' }}
          >
            {title}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1.5" aria-label="Stiker di bezel">
          {stickers.length === 0 ? (
            <span
              className="text-[11.5px] italic"
              style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#7a6f59' }}
            >
              Selesaikan misi untuk menempel stiker di sini.
            </span>
          ) : (
            stickers.map((s, i) => (
              <span
                key={`${s.label}-${i}`}
                className="rounded-[3px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  fontFamily: "'Pixelify Sans', sans-serif",
                  backgroundColor: s.color,
                  color: '#141820',
                  border: '1.5px solid rgba(0,0,0,0.45)',
                  transform: `rotate(${i % 2 === 0 ? -3 : 2.5}deg)`,
                  boxShadow: '0 2px 2px rgba(0,0,0,0.3)',
                }}
              >
                {s.label}
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          <motion.span
            aria-hidden
            className="block h-[15px] w-[15px] rounded-full"
            style={{
              backgroundColor: lamp.color,
              border: '2px solid rgba(0,0,0,0.5)',
              boxShadow: lamp.glow,
            }}
            animate={
              lampState === 'running'
                ? { opacity: [1, 0.45, 1] }
                : lampState === 'error'
                  ? { opacity: [1, 0.7, 1] }
                  : { opacity: 1 }
            }
            transition={
              lampState === 'ready'
                ? { duration: 0.3 }
                : { duration: lampState === 'running' ? 0.7 : 1.6, repeat: Infinity }
            }
          />
          <span
            className="text-[11px] font-bold tracking-[0.2em]"
            style={{ fontFamily: "'Press Start 2P', monospace", color: '#4a4234', fontSize: 9 }}
          >
            {lamp.text}
          </span>
        </div>
      </div>

      {/* Layar + rel kanan */}
      <div className="flex gap-3">
        <div
          className="relative min-w-0 flex-1 overflow-hidden rounded-[8px]"
          style={{
            backgroundColor: '#141820',
            border: '3px solid #8a7c62',
            boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.85)',
          }}
        >
          {children}
          <CRTScanlineOverlay opacity={0.4} />
        </div>
        {rightRail ? (
          <div className="flex w-[86px] shrink-0 flex-col items-center justify-start pt-3">
            {rightRail}
          </div>
        ) : null}
      </div>

      <p
        className="mt-2 px-1.5 text-[11.5px]"
        style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#7a6f59' }}
      >
        Selama Cyber-Deck terbuka, waktu desa berhenti. Pikirkan pelan-pelan, tidak ada yang
        mengejar.
      </p>
    </div>
  );
}

export default CyberDeckFrame;
