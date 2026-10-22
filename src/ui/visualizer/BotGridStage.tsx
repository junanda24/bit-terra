import { useEffect, useMemo, useReducer, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { QuestDefinition } from '../../shared/types';
import { eventBus } from '../../core/bridge/eventBus';
import {
  botStageStatusText,
  createBotStageReducer,
  createBotStageState,
  normalizeBotAction,
  type BotStageState,
} from './botStageLogic';

type BotWorldSetup = NonNullable<QuestDefinition['botWorldSetup']>;

/** Pose bot = state logika panggung (botStageLogic). Diekspor ulang agar
 * pemakai lama (CyberDeckScreen, ui/index) tidak berubah kontraknya. */
export type BotPose = BotStageState;
export { normalizeBotAction };
export type { BotActionKind, Facing } from './botStageLogic';

function SunPatch() {
  return (
    <svg viewBox="0 0 40 40" className="h-[72%] w-[72%]" aria-hidden>
      <g stroke="#b97e06" strokeWidth="2.4" strokeLinecap="square">
        <line x1="20" y1="3" x2="20" y2="8" />
        <line x1="20" y1="32" x2="20" y2="37" />
        <line x1="3" y1="20" x2="8" y2="20" />
        <line x1="32" y1="20" x2="37" y2="20" />
        <line x1="8" y1="8" x2="11.5" y2="11.5" />
        <line x1="28.5" y1="28.5" x2="32" y2="32" />
        <line x1="32" y1="8" x2="28.5" y2="11.5" />
        <line x1="11.5" y1="28.5" x2="8" y2="32" />
      </g>
      <circle cx="20" cy="20" r="7.5" fill="#f4b41b" stroke="#b97e06" strokeWidth="2" />
    </svg>
  );
}

function DizzyStars() {
  return (
    <motion.div
      aria-hidden
      className="absolute -top-[46%] left-1/2 h-6 w-14 -translate-x-1/2"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      style={{ transformOrigin: 'center 160%' }}
    >
      {[6, 26, 46].map((left, i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          className="absolute h-3.5 w-3.5"
          style={{ left, top: i === 1 ? -3 : 2 }}
        >
          <path
            d="M6 0 L7.4 4.2 L12 4.6 L8.4 7.2 L9.6 11.4 L6 9 L2.4 11.4 L3.6 7.2 L0 4.6 L4.6 4.2 Z"
            fill="#f4b41b"
            stroke="#b97e06"
            strokeWidth="0.8"
          />
        </svg>
      ))}
    </motion.div>
  );
}

/** Igauan robot tertidur: perintah yang fizzle hanya menghasilkan "Zzz". */
function SleepZzz() {
  return (
    <motion.div
      aria-hidden
      className="absolute -top-[40%] right-[2%] z-20"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: [0, 1, 1, 0], y: -7 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.15, ease: 'easeOut' }}
    >
      <span
        className="text-[15px] font-bold"
        style={{
          fontFamily: "'Pixelify Sans', sans-serif",
          color: '#aebdd1',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        Zzz
      </span>
    </motion.div>
  );
}

/** Zap redup: charge dicoba di tempat gelap — ada percik, tidak ada cahaya. */
function DimZap() {
  return (
    <motion.div
      aria-hidden
      className="absolute -top-[42%] left-1/2 z-20 -translate-x-1/2"
      animate={{ opacity: [0.9, 0.4, 0.75], scale: [1, 0.9, 1] }}
      transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M13 2 L4.5 13.5 H11 L9.5 22 L19 9.5 H12.5 Z"
          fill="#8d99ab"
          stroke="#5b6b7f"
          strokeWidth="1.4"
        />
      </svg>
    </motion.div>
  );
}

function MiniPiko({ awake, charged }: { awake: boolean; charged: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative grid h-[76%] w-[76%] place-items-center rounded-full"
        style={{
          backgroundColor: '#d8ccb8',
          border: '3px solid #8a4f30',
          boxShadow: charged
            ? '0 0 18px 4px rgba(244,180,27,0.75), inset 0 2px 0 rgba(255,255,255,0.5)'
            : 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 3px rgba(0,0,0,0.4)',
        }}
      >
        {/* daun antena */}
        <span
          aria-hidden
          className="absolute -top-[16%] left-1/2 h-[22%] w-[30%] -translate-x-1/2 rounded-full"
          style={{ backgroundColor: '#4b724f', border: '2px solid #2c4630' }}
        />
        <div
          className="grid h-[62%] w-[68%] place-items-center rounded-[38%]"
          style={{ backgroundColor: '#0d2b1a', border: '2px solid #123c24' }}
        >
          {awake ? (
            <span
              className="text-[clamp(9px,1.6vw,15px)] font-bold leading-none"
              style={{ color: '#7dffcb', fontFamily: "'JetBrains Mono', monospace" }}
            >
              ^ ^
            </span>
          ) : (
            <span
              className="text-[clamp(8px,1.4vw,13px)] leading-none"
              style={{ color: '#2c5c40', fontFamily: "'JetBrains Mono', monospace" }}
            >
              - -
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export interface BotGridStageProps {
  setup: BotWorldSetup;
  /** Posisi awal token [x, y]. Default [0, 0]. */
  startPos?: [number, number];
  /** Naikkan nilainya untuk mengembalikan token ke posisi awal (run baru). */
  resetKey?: string | number;
  onPoseChange?: (pose: BotPose) => void;
}

/**
 * Panggung grid DOM — pengganti sementara dunia Phaser (Fase 2).
 * Semua semantik dunia hidup di reducer murni botStageLogic: urutan boot
 * ditegakkan (aksi saat tertidur fizzle jadi "Zzz"), charge di tempat gelap
 * adalah sinyal 'charged-dark' sendiri (zap redup), dan tabrakan adalah
 * latch per run yang terpisah. Komponen ini hanya menggambar + meneruskan
 * event bus ke reducer.
 */
export function BotGridStage({ setup, startPos = [0, 0], resetKey = 0, onPoseChange }: BotGridStageProps) {
  const [cols, rows] = setup.gridSize;
  const reducer = useMemo(() => createBotStageReducer(setup), [setup]);
  const [pose, dispatch] = useReducer(reducer, startPos, (sp) =>
    createBotStageState(setup, sp),
  );

  const startPosRef = useRef(startPos);
  startPosRef.current = startPos;
  const onPoseChangeRef = useRef(onPoseChange);
  onPoseChangeRef.current = onPoseChange;

  useEffect(() => {
    onPoseChangeRef.current?.(pose);
  }, [pose]);

  // Run baru / setup berganti → dunia kembali ke keadaan awal (latch
  // tabrakan & charge-gelap ikut bersih; F-02).
  useEffect(() => {
    dispatch({ type: 'reset', startPos: startPosRef.current });
  }, [resetKey, setup]);

  // Sinyal visual sesaat padam sendiri.
  useEffect(() => {
    if (!pose.dizzy && !pose.sleepFizzle && !pose.dimZap) return;
    const id = window.setTimeout(() => dispatch({ type: 'clear-transients' }), 1300);
    return () => window.clearTimeout(id);
  }, [pose.dizzy, pose.sleepFizzle, pose.dimZap]);

  useEffect(() => {
    const handleAction = ({ action, args }: { action: string; args: unknown[] }) => {
      dispatch({ type: 'bot', kind: normalizeBotAction(action), stepsArg: args[0] });
    };
    const handleFunnyFail = ({ reactionKey }: { reactionKey: string }) => {
      dispatch({ type: 'funny-fail', reactionKey });
    };
    eventBus.on('BOT_ACTION', handleAction);
    eventBus.on('QUEST_FUNNY_FAIL', handleFunnyFail);
    return () => {
      eventBus.off('BOT_ACTION', handleAction);
      eventBus.off('QUEST_FUNNY_FAIL', handleFunnyFail);
    };
  }, []);

  const cellPctW = 100 / cols;
  const cellPctH = 100 / rows;

  return (
    <div className="relative h-full w-full select-none overflow-hidden" aria-label="Panggung robot Piko">
      {/* lantai papan kayu bengkel */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#241a12',
          backgroundImage:
            'linear-gradient(rgba(216,204,184,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(216,204,184,0.13) 1px, transparent 1px)',
          backgroundSize: `${cellPctW}% ${cellPctH}%`,
        }}
      />
      {/* petak cahaya matahari (target) */}
      {setup.targets.map(([x, y]) => (
        <motion.div
          key={`t-${x}-${y}`}
          className="absolute grid place-items-center"
          style={{
            left: `${x * cellPctW}%`,
            top: `${y * cellPctH}%`,
            width: `${cellPctW}%`,
            height: `${cellPctH}%`,
            background:
              'radial-gradient(circle at 50% 45%, rgba(244,180,27,0.5), rgba(244,180,27,0.12) 70%)',
          }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <SunPatch />
        </motion.div>
      ))}
      {/* rintangan: peti kayu */}
      {setup.obstacles.map(([x, y]) => (
        <div
          key={`o-${x}-${y}`}
          className="absolute grid place-items-center"
          style={{
            left: `${x * cellPctW}%`,
            top: `${y * cellPctH}%`,
            width: `${cellPctW}%`,
            height: `${cellPctH}%`,
          }}
        >
          <div
            className="relative h-[82%] w-[82%] rounded-[4px]"
            style={{
              backgroundColor: '#a85432',
              border: '3px solid #66300f',
              boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.22), 0 3px 4px rgba(0,0,0,0.45)',
              backgroundImage:
                'linear-gradient(45deg, transparent 46%, rgba(102,48,15,0.85) 46%, rgba(102,48,15,0.85) 54%, transparent 54%), linear-gradient(-45deg, transparent 46%, rgba(102,48,15,0.85) 46%, rgba(102,48,15,0.85) 54%, transparent 54%)',
            }}
          />
        </div>
      ))}
      {/* token Piko */}
      <motion.div
        className="absolute z-10"
        style={{ width: `${cellPctW}%`, height: `${cellPctH}%` }}
        initial={false}
        animate={{
          left: `${pose.x * cellPctW}%`,
          top: `${pose.y * cellPctH}%`,
          rotate: pose.dizzy ? [0, -7, 7, -5, 0] : pose.sleepFizzle ? [0, -2, 2, 0] : 0,
        }}
        transition={{
          left: { type: 'spring', stiffness: 170, damping: 20 },
          top: { type: 'spring', stiffness: 170, damping: 20 },
          rotate: { duration: 0.45 },
        }}
      >
        <div className="relative h-full w-full">
          <MiniPiko awake={pose.awake} charged={pose.charged} />
          <AnimatePresence>{pose.dizzy ? <DizzyStars key="dizzy" /> : null}</AnimatePresence>
          <AnimatePresence>{pose.sleepFizzle ? <SleepZzz key="zzz" /> : null}</AnimatePresence>
          <AnimatePresence>{pose.dimZap ? <DimZap key="zap" /> : null}</AnimatePresence>
        </div>
      </motion.div>
      {/* label status kecil */}
      <div
        className="absolute bottom-1.5 left-2 z-10 rounded-[3px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{
          fontFamily: "'Pixelify Sans', sans-serif",
          backgroundColor: 'rgba(11,14,20,0.82)',
          color:
            pose.status === 'charged'
              ? '#f4b41b'
              : pose.status === 'charged-dark'
                ? '#d8a84e'
                : pose.awake
                  ? '#7dffcb'
                  : '#8d99ab',
          border: '1.5px solid rgba(216,204,184,0.25)',
        }}
      >
        {botStageStatusText(pose)}
      </div>
    </div>
  );
}

export default BotGridStage;
