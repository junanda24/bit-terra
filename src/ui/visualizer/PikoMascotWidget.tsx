import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { PikoMood } from '../../shared/types';
import { useGameStore } from '../../core/bridge/gameStore';

/** Mata Piko di layar CRT, digambar sebagai path SVG per suasana hati. */
function Eyes({ mood }: { mood: PikoMood }) {
  const stroke = '#7dffcb';
  const common = {
    stroke,
    strokeWidth: 3.4,
    fill: 'none',
    strokeLinecap: 'round' as const,
  };
  switch (mood) {
    case 'happy':
      // ∩ ∩ — mata terpejam senang
      return (
        <g {...common}>
          <path d="M34 52 q7 -9 14 0" />
          <path d="M72 52 q7 -9 14 0" />
          <path d="M50 66 q10 8 20 0" strokeWidth={3} />
        </g>
      );
    case 'confused':
      // o_O — satu kecil satu besar, mulut miring
      return (
        <g>
          <circle cx="41" cy="50" r="3.6" fill={stroke} />
          <circle cx="79" cy="50" r="6.4" fill="none" stroke={stroke} strokeWidth={3} />
          <path d="M52 69 l16 -3" {...common} strokeWidth={3} />
        </g>
      );
    case 'shocked':
      // X X — silang kaget + mulut O
      return (
        <g {...common}>
          <path d="M34 43 l13 13 M47 43 l-13 13" />
          <path d="M73 43 l13 13 M86 43 l-13 13" />
          <circle cx="60" cy="70" r="4.6" strokeWidth={3} />
        </g>
      );
    default:
      // ^ ^ — tatapan normal yang ramah
      return (
        <g {...common}>
          <path d="M34 55 l7 -8 7 8" />
          <path d="M72 55 l7 -8 7 8" />
          <path d="M53 67 q7 4 14 0" strokeWidth={2.6} />
        </g>
      );
  }
}

function PikoBody({ mood }: { mood: PikoMood }) {
  return (
    <svg viewBox="0 0 120 118" width="100%" height="100%" role="img" aria-label="Piko, robot pendamping">
      {/* antena + daun */}
      <line x1="60" y1="16" x2="60" y2="30" stroke="#8a4f30" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 15 q14 -11 22 -2 q-9 10 -22 2 Z" fill="#4b724f" stroke="#2c4630" strokeWidth="2" />
      {/* kaki */}
      <rect x="40" y="102" width="14" height="9" rx="3" fill="#8a4f30" />
      <rect x="66" y="102" width="14" height="9" rx="3" fill="#8a4f30" />
      {/* badan bulat */}
      <circle cx="60" cy="66" r="40" fill="#d8ccb8" stroke="#8a4f30" strokeWidth="3.5" />
      <circle cx="60" cy="66" r="40" fill="none" stroke="#fff7ea" strokeWidth="2" opacity="0.35" />
      {/* perut tembaga */}
      <circle cx="60" cy="88" r="9" fill="#c87d55" stroke="#8a4f30" strokeWidth="2.4" />
      <circle cx="60" cy="88" r="3.4" fill="#f4b41b" />
      {/* layar wajah CRT hijau */}
      <rect x="26" y="34" width="68" height="52" rx="12" fill="#0d2b1a" stroke="#123c24" strokeWidth="3" />
      <rect x="26" y="34" width="68" height="52" rx="12" fill="#39ff9a" opacity="0.07" />
      <Eyes mood={mood} />
      {/* pipi */}
      <circle cx="33" cy="66" r="3.4" fill="#ff9e7d" opacity="0.75" />
      <circle cx="87" cy="66" r="3.4" fill="#ff9e7d" opacity="0.75" />
    </svg>
  );
}

export interface PikoMascotWidgetProps {
  /** Override suasana hati. Default: dari pikoLine di game store. */
  mood?: PikoMood;
  /** Override teks balon bicara. Default: pikoLine di game store. */
  line?: string | null;
  size?: number;
}

/**
 * Piko — maskot robot + "linter hidup". Susunan VERTIKAL (audit layout E):
 * avatar kecil + nama di baris atas, balon bicara SELEBAR KOLOM PENUH di
 * bawahnya — dulu balon terjepit 170px di samping avatar 118px sehingga
 * teks cerita 561 karakter jadi menara ±24 baris. Balon hanya untuk kalimat
 * pendek Piko; teks cerita tinggal di dialog/panel Cerita. Balon adalah
 * live region (role=status) agar pembaca layar mendengar diagnosis,
 * petunjuk, dan reaksi Piko (audit UI F-05).
 */
export function PikoMascotWidget({ mood: moodProp, line: lineProp, size = 56 }: PikoMascotWidgetProps) {
  const storeLine = useGameStore((s) => s.pikoLine);
  const mood: PikoMood = moodProp ?? storeLine?.mood ?? 'normal';
  const line = lineProp !== undefined ? lineProp : storeLine?.text ?? null;
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <motion.div
          key={mood}
          style={{ width: size, height: size, flexShrink: 0 }}
          initial={{ scale: 0.92 }}
          animate={
            reduceMotion
              ? { scale: 1 }
              : mood === 'happy'
                ? { y: [0, -9, 0, -5, 0], rotate: [0, 0, 360, 360, 360], scale: 1 }
                : mood === 'shocked'
                  ? { x: [0, -4, 4, -3, 3, 0], rotate: [0, -3, 3, -2, 0, 0], scale: 1 }
                  : mood === 'confused'
                    ? { rotate: [0, -8, -6, -8], y: [0, 1, 0, 1], scale: 1 }
                    : { y: [0, -2, 0], rotate: 0, scale: 1 }
          }
          transition={
            mood === 'normal' && !reduceMotion
              ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
              : { duration: mood === 'happy' ? 0.85 : 0.55, ease: 'easeOut' }
          }
        >
          <PikoBody mood={mood} />
        </motion.div>
        <div className="min-w-0">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#f4b41b' }}
          >
            Piko
          </p>
          <p
            className="text-[12.5px]"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
          >
            Asisten bot bengkel Kakek
          </p>
        </div>
      </div>

      <div className="relative" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {line ? (
            <motion.div
              key={line}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="relative rounded-[6px] px-3 py-2"
              style={{
                backgroundColor: '#fff7ea',
                border: '2px solid #8a4f30',
                boxShadow: '0 3px 0 rgba(0,0,0,0.4)',
              }}
            >
              {/* ekor balon mengarah ke avatar di atas */}
              <span
                aria-hidden
                className="absolute -top-[7px] left-6 block h-3 w-3 rotate-45"
                style={{
                  backgroundColor: '#fff7ea',
                  borderLeft: '2px solid #8a4f30',
                  borderTop: '2px solid #8a4f30',
                }}
              />
              <p
                className="text-[14.5px] leading-snug"
                style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#26303f' }}
              >
                {line}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-1 text-[13.5px] italic"
              style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
            >
              Piko siap membantu. Tulis kodemu, aku awasi dari sini.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default PikoMascotWidget;
