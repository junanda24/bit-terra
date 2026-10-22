import { motion } from 'framer-motion';
import { useGameStore } from '../../core/bridge/gameStore';

function SunIcon({ dim }: { dim: boolean }) {
  const stroke = dim ? '#5b6b7f' : '#f4b41b';
  const fill = dim ? '#39434f' : '#f4b41b';
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <g stroke={stroke} strokeWidth="2" strokeLinecap="square">
        <line x1="12" y1="1.5" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22.5" y2="12" />
        <line x1="4.2" y1="4.2" x2="6" y2="6" />
        <line x1="18" y1="18" x2="19.8" y2="19.8" />
        <line x1="19.8" y1="4.2" x2="18" y2="6" />
        <line x1="6" y1="18" x2="4.2" y2="19.8" />
      </g>
      <circle cx="12" cy="12" r="4.6" fill={fill} stroke={stroke} strokeWidth="1.6" />
    </svg>
  );
}

export interface FocusBarProps {
  /** Override nilai fokus (0–100). Default: baca dari game store. */
  focus?: number;
}

/**
 * Brain Fog / Focus Bar (BLUEPRINT §6): matahari yang meredup saat fokus
 * menipis. Error saat Run mengurangi fokus; habis → Piko menyarankan istirahat.
 */
export function FocusBar({ focus: focusProp }: FocusBarProps) {
  const storeFocus = useGameStore((s) => s.focus);
  const focus = Math.max(0, Math.min(100, Math.round(focusProp ?? storeFocus)));
  const low = focus <= 30;
  const critical = focus <= 10;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2.5">
        <motion.span
          aria-hidden
          animate={critical ? { rotate: [0, -6, 6, 0], scale: [1, 0.92, 1] } : { rotate: 0, scale: 1 }}
          transition={critical ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
          className="grid shrink-0 place-items-center"
        >
          <SunIcon dim={low} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <div
            className="flex items-baseline justify-between text-[12px] font-bold uppercase tracking-[0.16em]"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#d8ccb8' }}
          >
            <span>Fokus</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: low ? '#ff4d6d' : '#f4b41b' }}>
              {focus}
            </span>
          </div>
          <div
            className="mt-1 h-[12px] w-full overflow-hidden rounded-[3px]"
            style={{
              backgroundColor: '#0b0e14',
              border: '2px solid rgba(0,0,0,0.6)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7)',
            }}
            role="progressbar"
            aria-valuenow={focus}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Fokus pemain"
          >
            <motion.div
              className="h-full"
              animate={{ width: `${focus}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              style={{
                backgroundColor: critical ? '#ff4d6d' : low ? '#e07b39' : '#f4b41b',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            />
          </div>
        </div>
      </div>
      {low ? (
        <p
          className="mt-2 text-[13px] leading-snug"
          style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#ffb3a7' }}
        >
          Kabut otak mulai menebal. Kata Piko: rehat sebentar — kopi hangat di Kafe Byte &amp;
          Bean, memancing di sungai, atau tidur siang di bengkel.
        </p>
      ) : null}
    </div>
  );
}

export default FocusBar;
