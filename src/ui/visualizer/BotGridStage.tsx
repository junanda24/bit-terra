import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { QuestDefinition } from '../../shared/types';
import { eventBus } from '../../core/bridge/eventBus';

type BotWorldSetup = NonNullable<QuestDefinition['botWorldSetup']>;

/** 0 = timur, 1 = selatan, 2 = barat, 3 = utara. */
export type Facing = 0 | 1 | 2 | 3;

export interface BotPose {
  x: number;
  y: number;
  facing: Facing;
  awake: boolean;
  charged: boolean;
  dizzy: boolean;
  onTarget: boolean;
}

export type BotActionKind =
  | 'move'
  | 'turn-left'
  | 'turn-right'
  | 'boot'
  | 'charge'
  | 'open'
  | 'close'
  | 'unknown';

/** Normalisasi nama aksi bot: "piko.moveForward" → move, "gate.open" → open. */
export function normalizeBotAction(action: string): BotActionKind {
  const base = action.split('.').pop()?.toLowerCase() ?? '';
  if (base === 'moveforward' || base === 'move' || base === 'forward' || base === 'step') return 'move';
  if (base === 'turnleft' || base === 'left') return 'turn-left';
  if (base === 'turnright' || base === 'right') return 'turn-right';
  if (base === 'boot' || base === 'wake' || base === 'wakeup' || base === 'on') return 'boot';
  if (base === 'charge' || base === 'charging' || base === 'isi-daya') return 'charge';
  if (base === 'open') return 'open';
  if (base === 'close') return 'close';
  return 'unknown';
}

const DELTAS: Record<Facing, [number, number]> = {
  0: [1, 0],
  1: [0, 1],
  2: [-1, 0],
  3: [0, -1],
};

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
 * Mendengarkan BOT_ACTION dari eventBus: Piko melangkah sel demi sel mengikuti
 * baris kode pemain; menabrak rintangan = bintang pusing (gagal itu lucu).
 * Komponen ini mandiri: tidak menyentuh Phaser sama sekali.
 */
export function BotGridStage({ setup, startPos = [0, 0], resetKey = 0, onPoseChange }: BotGridStageProps) {
  const [cols, rows] = setup.gridSize;
  const obstacleSet = useMemo(
    () => new Set(setup.obstacles.map(([x, y]) => `${x},${y}`)),
    [setup.obstacles],
  );
  const targetSet = useMemo(
    () => new Set(setup.targets.map(([x, y]) => `${x},${y}`)),
    [setup.targets],
  );

  const initialPose = useCallback((): BotPose => {
    const [sx, sy] = startPos;
    return {
      x: sx,
      y: sy,
      facing: 0,
      awake: false,
      charged: false,
      dizzy: false,
      onTarget: targetSet.has(`${sx},${sy}`),
    };
  }, [startPos, targetSet]);

  const [pose, setPose] = useState<BotPose>(initialPose);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const dizzyTimer = useRef<number | undefined>(undefined);
  const onPoseChangeRef = useRef(onPoseChange);
  onPoseChangeRef.current = onPoseChange;

  useEffect(() => {
    onPoseChangeRef.current?.(pose);
  }, [pose]);

  useEffect(() => {
    setPose(initialPose());
  }, [resetKey, initialPose]);

  const flashDizzy = useCallback(() => {
    setPose((p) => ({ ...p, dizzy: true }));
    window.clearTimeout(dizzyTimer.current);
    dizzyTimer.current = window.setTimeout(() => {
      setPose((p) => ({ ...p, dizzy: false }));
    }, 1400);
  }, []);

  useEffect(() => {
    const handleAction = ({ action, args }: { action: string; args: unknown[] }) => {
      const kind = normalizeBotAction(action);
      const cur = poseRef.current;
      switch (kind) {
        case 'boot':
          setPose((p) => ({ ...p, awake: true }));
          break;
        case 'turn-left':
          setPose((p) => ({ ...p, facing: ((p.facing + 3) % 4) as Facing }));
          break;
        case 'turn-right':
          setPose((p) => ({ ...p, facing: ((p.facing + 1) % 4) as Facing }));
          break;
        case 'move': {
          const stepsRaw = typeof args[0] === 'number' ? Math.floor(args[0]) : 1;
          const steps = Math.max(1, Math.min(12, stepsRaw || 1));
          const [dx, dy] = DELTAS[cur.facing];
          let nx = cur.x;
          let ny = cur.y;
          let crashed = false;
          for (let i = 0; i < steps; i++) {
            const tx = nx + dx;
            const ty = ny + dy;
            if (tx < 0 || ty < 0 || tx >= cols || ty >= rows || obstacleSet.has(`${tx},${ty}`)) {
              crashed = true;
              break;
            }
            nx = tx;
            ny = ty;
          }
          setPose((p) => ({
            ...p,
            x: nx,
            y: ny,
            onTarget: targetSet.has(`${nx},${ny}`),
          }));
          if (crashed) flashDizzy();
          break;
        }
        case 'charge': {
          const on = targetSet.has(`${cur.x},${cur.y}`);
          if (on) setPose((p) => ({ ...p, charged: true }));
          else flashDizzy();
          break;
        }
        default:
          break;
      }
    };
    const handleFunnyFail = () => flashDizzy();
    eventBus.on('BOT_ACTION', handleAction);
    eventBus.on('QUEST_FUNNY_FAIL', handleFunnyFail);
    return () => {
      eventBus.off('BOT_ACTION', handleAction);
      eventBus.off('QUEST_FUNNY_FAIL', handleFunnyFail);
    };
  }, [cols, rows, obstacleSet, targetSet, flashDizzy]);

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
          rotate: pose.dizzy ? [0, -7, 7, -5, 0] : 0,
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
        </div>
      </motion.div>
      {/* label status kecil */}
      <div
        className="absolute bottom-1.5 left-2 z-10 rounded-[3px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{
          fontFamily: "'Pixelify Sans', sans-serif",
          backgroundColor: 'rgba(11,14,20,0.82)',
          color: pose.charged ? '#f4b41b' : pose.awake ? '#7dffcb' : '#8d99ab',
          border: '1.5px solid rgba(216,204,184,0.25)',
        }}
      >
        {pose.charged ? 'Daya terisi penuh' : pose.awake ? 'Piko aktif' : 'Piko tertidur'}
      </div>
    </div>
  );
}

export default BotGridStage;
