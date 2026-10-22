import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { QuestDefinition } from '../../shared/types';
import { eventBus } from '../../core/bridge/eventBus';
import {
  botStageStatusText,
  createBotStageReducer,
  createBotStageState,
  fitStageBox,
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

/** Tetesan segar: water() baru saja menyiram tanaman betulan (Q7). */
function DropletPop() {
  return (
    <motion.div
      aria-hidden
      className="absolute -top-[42%] left-1/2 z-20 -translate-x-1/2"
      initial={{ opacity: 0, y: -3, scale: 0.7 }}
      animate={{ opacity: [0, 1, 0.9], y: 2, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M12 3 C12 3 5.5 11 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 11 12 3 12 3 Z"
          fill="#7cc4de"
          stroke="#3b82a6"
          strokeWidth="1.6"
        />
      </svg>
    </motion.div>
  );
}

/** Percikan percuma: water() di petak tanpa tanaman (Q7). */
function SplashPop() {
  return (
    <motion.div
      aria-hidden
      className="absolute -bottom-[16%] left-1/2 z-20 -translate-x-1/2"
      initial={{ opacity: 0, scaleX: 0.5 }}
      animate={{ opacity: [0, 0.9, 0.5], scaleX: 1.15 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <svg viewBox="0 0 32 10" className="h-2.5 w-8">
        <ellipse cx="16" cy="5" rx="13" ry="3.6" fill="none" stroke="#7cc4de" strokeWidth="1.8" />
        <ellipse cx="16" cy="5" rx="6" ry="1.8" fill="none" stroke="#3b82a6" strokeWidth="1.4" />
      </svg>
    </motion.div>
  );
}

/** Peti roti yang bisa didorong (Q5): kayu terang + tanda roti di tutupnya. */
function BreadCrate() {
  return (
    <div
      className="relative h-[84%] w-[84%] rounded-[4px]"
      style={{
        backgroundColor: '#c98d4e',
        border: '3px solid #7a4a1c',
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.3), 0 3px 4px rgba(0,0,0,0.45)',
      }}
    >
      <svg viewBox="0 0 40 24" className="absolute inset-x-[16%] top-[22%] h-[56%] w-[68%]" aria-hidden>
        <path
          d="M4 15 a8 7 0 0 1 3-6.6 A10 6 0 0 1 20 5 a10 6 0 0 1 13 3.4 A8 7 0 0 1 36 15 L36 18 L4 18 Z"
          fill="#e8cf9f"
          stroke="#7a4a1c"
          strokeWidth="1.8"
        />
        <path d="M13 9 l3 4 M20 8 l3 4 M27 9 l3 4" stroke="#b8934a" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Tunas tanaman (Q7): kering = cokelat menekuk; tersiram = hijau segar. */
function PlantSprout({ watered }: { watered: boolean }) {
  return (
    <div className="relative flex h-full w-full items-end justify-center">
      <div
        className="absolute bottom-[8%] h-[26%] w-[78%] rounded-[50%]"
        style={{ backgroundColor: '#4a3520' }}
      />
      <svg viewBox="0 0 40 40" className="relative h-[86%] w-[86%]" aria-hidden>
        {watered ? (
          <g stroke="#3f7a3a" strokeWidth="2.6" fill="#5da24f">
            <path d="M20 36 C20 28 20 20 20 13" fill="none" strokeLinecap="round" />
            <path d="M20 22 C14 22 10 18 9 12 C15 12 19 15 20 22 Z" />
            <path d="M20 18 C26 18 30 14 31 8 C25 8 21 11 20 18 Z" />
            <circle cx="29" cy="26" r="2.2" fill="#7cc4de" stroke="none" />
          </g>
        ) : (
          <g stroke="#8a6a48" strokeWidth="2.6" fill="#a8895c">
            <path d="M20 36 C20 29 21 24 24 19" fill="none" strokeLinecap="round" />
            <path d="M23 24 C17 26 12 24 10 19 C16 17 21 19 23 24 Z" />
            <path d="M24 20 C29 18 33 19 35 23 C30 25 26 24 24 20 Z" />
          </g>
        )}
      </svg>
    </div>
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
    if (!pose.dizzy && !pose.sleepFizzle && !pose.dimZap && !pose.droplet && !pose.splash) return;
    const id = window.setTimeout(() => dispatch({ type: 'clear-transients' }), 1300);
    return () => window.clearTimeout(id);
  }, [pose.dizzy, pose.sleepFizzle, pose.dimZap, pose.droplet, pose.splash]);

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
  const targetKind = setup.targetKind ?? 'sun';
  const gardenFloor = (setup.plants?.length ?? 0) > 0;

  // Kotak panggung berasio grid TERKUNCI (audit layout B): dulu sel digambar
  // sebagai % dari kontainer panel yang tingginya arbitrer, jadi petak dan
  // Piko meregang 2,07–2,8x jadi kapsul. Sekarang panggung diukur, kotak
  // terbesar berasio cols:rows dipasang di tengah, sel = % dari kotak itu.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () =>
      setBox(fitStageBox(el.clientWidth, el.clientHeight, cols, rows));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);
  const reduceMotion = useReducedMotion();

  return (
    <div
      ref={wrapRef}
      className="flex h-full w-full items-center justify-center p-3"
      role="img"
      aria-label="Panggung robot Piko"
    >
      <div
        className="relative select-none overflow-hidden"
        style={{ width: box.width, height: box.height }}
      >
      {/* lantai: papan kayu bengkel, atau tanah kebun untuk quest bertanaman */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: gardenFloor ? '#22331d' : '#241a12',
          backgroundImage:
            'linear-gradient(rgba(216,204,184,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(216,204,184,0.13) 1px, transparent 1px)',
          backgroundSize: `${cellPctW}% ${cellPctH}%`,
        }}
      />
      {/* petak target — gambarnya mengikuti targetKind setup */}
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
              targetKind === 'sun'
                ? 'radial-gradient(circle at 50% 45%, rgba(244,180,27,0.5), rgba(244,180,27,0.12) 70%)'
                : undefined,
          }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: [0.85, 1, 0.85] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          {targetKind === 'sun' ? (
            <SunPatch />
          ) : targetKind === 'platform' ? (
            <div
              className="grid h-[76%] w-[76%] place-items-center rounded-[4px]"
              style={{
                backgroundColor: '#8a5a33',
                border: '3px solid #c87d55',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.25)',
              }}
            >
              <div
                className="h-[38%] w-[38%] rounded-full"
                style={{ backgroundColor: '#f4b41b', border: '2px solid #7a4a1c' }}
              />
            </div>
          ) : (
            <div
              className="grid h-[82%] w-[82%] place-items-center rounded-[4px]"
              style={{ border: '3px dashed rgba(244,180,27,0.85)' }}
            >
              <svg viewBox="0 0 24 24" className="h-[46%] w-[46%]" aria-hidden>
                <path
                  d="M12 2.5 L14.6 9 L21.5 9.3 L16.2 13.6 L17.9 20.2 L12 16.4 L6.1 20.2 L7.8 13.6 L2.5 9.3 L9.4 9 Z"
                  fill="rgba(244,180,27,0.5)"
                  stroke="#f4b41b"
                  strokeWidth="1.4"
                />
              </svg>
            </div>
          )}
        </motion.div>
      ))}
      {/* tanaman (Q7): tunas kering/hijau di petak tanahnya */}
      {(setup.plants ?? []).map(([x, y]) => (
        <div
          key={`p-${x}-${y}`}
          className="absolute"
          style={{
            left: `${x * cellPctW}%`,
            top: `${y * cellPctH}%`,
            width: `${cellPctW}%`,
            height: `${cellPctH}%`,
          }}
        >
          <PlantSprout watered={pose.wateredPlants.includes(`${x},${y}`)} />
        </div>
      ))}
      {/* pintu air (Q3): bilah terangkat saat gate terbuka + aliran di bawahnya */}
      {setup.gateTile ? (
        <div
          className="absolute"
          style={{
            left: `${setup.gateTile[0] * cellPctW}%`,
            top: `${setup.gateTile[1] * cellPctH}%`,
            width: `${cellPctW}%`,
            height: `${cellPctH}%`,
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[3px]">
            <div
              className="absolute inset-y-0 left-0 w-[16%]"
              style={{ backgroundColor: '#6e6259', borderRight: '2px solid #453b33' }}
            />
            <div
              className="absolute inset-y-0 right-0 w-[16%]"
              style={{ backgroundColor: '#6e6259', borderLeft: '2px solid #453b33' }}
            />
            {pose.gateOpen ? (
              <motion.div
                className="absolute inset-x-[16%] bottom-0 top-[46%]"
                style={{
                  background:
                    'repeating-linear-gradient(180deg, rgba(124,196,222,0.85) 0 5px, rgba(59,130,166,0.85) 5px 10px)',
                }}
                animate={reduceMotion ? { opacity: 0.9 } : { opacity: [0.75, 1, 0.75] }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
                }
              />
            ) : null}
            <div
              className="absolute inset-x-[14%] top-0 h-[58%]"
              style={{
                backgroundColor: '#a85432',
                border: '2px solid #66300f',
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent 0 10px, rgba(102,48,15,0.7) 10px 13px)',
                transform: pose.gateOpen ? 'translateY(-72%)' : 'translateY(0)',
                transition: 'transform 450ms ease-in-out',
              }}
            />
          </div>
        </div>
      ) : null}
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
      {/* peti dorong (Q5): posisi dari pose reducer, ikut bergeser mulus */}
      {pose.boxes.map(([x, y], i) => (
        <motion.div
          key={`b-${i}`}
          className="absolute z-[5] grid place-items-center"
          style={{ width: `${cellPctW}%`, height: `${cellPctH}%` }}
          initial={false}
          animate={{ left: `${x * cellPctW}%`, top: `${y * cellPctH}%` }}
          transition={{
            left: { type: 'spring', stiffness: 170, damping: 20 },
            top: { type: 'spring', stiffness: 170, damping: 20 },
          }}
        >
          <BreadCrate />
        </motion.div>
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
          {/* penunjuk arah hadap: segitiga tembaga di tepi token, berputar
              mengikuti facing (0 timur → 1 selatan → 2 barat → 3 utara) */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              transform: `rotate(${pose.facing * 90}deg)`,
              transition: 'transform 220ms ease-in-out',
            }}
          >
            <div
              className="absolute right-[1%] top-1/2 h-0 w-0 -translate-y-1/2"
              style={{
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: '8px solid #c87d55',
              }}
            />
          </div>
          <AnimatePresence>{pose.dizzy ? <DizzyStars key="dizzy" /> : null}</AnimatePresence>
          <AnimatePresence>{pose.sleepFizzle ? <SleepZzz key="zzz" /> : null}</AnimatePresence>
          <AnimatePresence>{pose.dimZap ? <DimZap key="zap" /> : null}</AnimatePresence>
          <AnimatePresence>{pose.droplet ? <DropletPop key="drop" /> : null}</AnimatePresence>
          <AnimatePresence>{pose.splash ? <SplashPop key="splash" /> : null}</AnimatePresence>
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
      {/* lencana pintu air (hanya panggung yang punya gateTile) */}
      {setup.gateTile ? (
        <div
          className="absolute bottom-1.5 right-2 z-10 rounded-[3px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{
            fontFamily: "'Pixelify Sans', sans-serif",
            backgroundColor: 'rgba(11,14,20,0.82)',
            color: pose.gateOpen ? '#7cc4de' : '#8d99ab',
            border: '1.5px solid rgba(216,204,184,0.25)',
          }}
        >
          {pose.gateOpen ? 'Pintu air terbuka' : 'Pintu air tertutup'}
        </div>
      ) : null}
      </div>
    </div>
  );
}

export default BotGridStage;
