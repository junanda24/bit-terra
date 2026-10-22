import { useEffect, useRef, useState } from 'react';
import { eventBus } from '../../core/bridge/eventBus';
import { useGameStore } from '../../core/bridge/gameStore';
import { logError } from '../../app/errorLog';
import { worldBridge } from '../../world/bridgeState';
import { getObjectiveHint } from '../../world/worldState';
import type { WorldHandle } from '../../world/createWorld';
import { DialogueBox } from '../hud/DialogueBox';
import { PixelButton } from '../design-system/PixelButton';
import { NineSlicePanel } from '../design-system/NineSlicePanel';

export interface WorldScreenProps {
  musicOn: boolean;
  onToggleMusic: () => void;
  onOpenMissions: () => void;
}

interface ActiveDialogue {
  name: string;
  lines: string[];
  index: number;
}

type WorldStatus = 'loading' | 'ready' | 'error';

/**
 * Layar Desa Bit-Terra (Fase 2): me-mount dunia Phaser lewat createWorld
 * (dimuat dinamis — Phaser jadi chunk sendiri), menampilkan HUD DOM
 * (petunjuk tujuan, fokus, tombol Misi/Musik, petunjuk interaksi), dialog
 * NPC, dan kontrol sentuh (joystick + tombol interaksi).
 *
 * Dunia tetap hidup saat Cyber-Deck terbuka (App menyembunyikannya) —
 * posisi pemain dan keadaan desa tidak hilang.
 */
export function WorldScreen({ musicOn, onToggleMusic, onOpenMissions }: WorldScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<WorldHandle | null>(null);
  const [status, setStatus] = useState<WorldStatus>('loading');
  const [prompt, setPrompt] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<ActiveDialogue | null>(null);
  const dialogueRef = useRef<ActiveDialogue | null>(null);
  const lineDoneRef = useRef(false);
  const [isTouch, setIsTouch] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickBaseRef = useRef<HTMLDivElement>(null);

  const completedQuests = useGameStore((s) => s.completedQuests);
  const focus = useGameStore((s) => s.focus);
  const completedRef = useRef(completedQuests);
  completedRef.current = completedQuests;

  // Mount dunia sekali. Guard `cancelled` untuk StrictMode (effect ganda):
  // handle yang telanjur lahir setelah cleanup langsung dihancurkan.
  useEffect(() => {
    let cancelled = false;
    let handle: WorldHandle | null = null;
    void (async () => {
      try {
        const { createWorld } = await import('../../world/createWorld');
        if (cancelled || !containerRef.current) return;
        handle = await createWorld(containerRef.current, completedRef.current);
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        setStatus('ready');
      } catch (err) {
        console.error('[Bit-Terra] Dunia gagal dimuat:', err);
        logError(err, 'world-load');
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keadaan dunia mengikuti progres (turunan murni di worldState).
  useEffect(() => {
    handleRef.current?.setCompletedQuests(completedQuests);
  }, [completedQuests]);

  // Prompt interaksi dari scene.
  useEffect(() => {
    const onPrompt = (e: { text: string | null }) => setPrompt(e.text);
    eventBus.on('WORLD_PROMPT', onPrompt);
    return () => eventBus.off('WORLD_PROMPT', onPrompt);
  }, []);

  // Dialog dari scene: buka = dunia pause; tutup = jalan lagi. Pause di
  // bridge dihitung bertumpuk, jadi aman walau deck juga membuka di atasnya.
  useEffect(() => {
    const onDialogue = (e: { name: string; lines: string[] }) => {
      if (e.lines.length === 0) return;
      if (!dialogueRef.current) eventBus.emit('WORLD_PAUSE', undefined);
      const next = { name: e.name, lines: e.lines, index: 0 };
      dialogueRef.current = next;
      lineDoneRef.current = false;
      setDialogue(next);
    };
    eventBus.on('WORLD_DIALOGUE', onDialogue);
    return () => eventBus.off('WORLD_DIALOGUE', onDialogue);
  }, []);

  useEffect(() => {
    setIsTouch(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  const closeDialogue = () => {
    dialogueRef.current = null;
    setDialogue(null);
    eventBus.emit('WORLD_RESUME', undefined);
  };

  const advanceDialogue = () => {
    const current = dialogueRef.current;
    if (!current) return;
    if (!lineDoneRef.current) return; // klik pertama menyelesaikan typewriter (di DialogueBox)
    if (current.index < current.lines.length - 1) {
      const next = { ...current, index: current.index + 1 };
      dialogueRef.current = next;
      lineDoneRef.current = false;
      setDialogue(next);
    } else {
      closeDialogue();
    }
  };

  // ------------------------------------------------------------ joystick
  const updateStick = (clientX: number, clientY: number) => {
    const el = stickBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / (rect.width / 2);
    let dy = (clientY - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const dead = 0.16;
    worldBridge.touch.x = Math.abs(dx) < dead ? 0 : dx;
    worldBridge.touch.y = Math.abs(dy) < dead ? 0 : dy;
    setStick({ x: dx, y: dy });
  };
  const resetStick = () => {
    worldBridge.touch.x = 0;
    worldBridge.touch.y = 0;
    setStick({ x: 0, y: 0 });
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: '#1d2b1a', fontFamily: '"Pixelify Sans", sans-serif' }}
    >
      {/* Kanvas Phaser */}
      <div ref={containerRef} className="bt-world-canvas absolute inset-0" />

      {status === 'loading' && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: '#1d2b1a' }}
          role="status"
        >
          <p style={{ color: 'var(--bt-bezel)' }}>Menyiapkan Desa Bit-Terra…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <NineSlicePanel variant="slate" className="max-w-md">
            <div className="px-4 py-3">
              <p className="mb-3" style={{ color: 'var(--bt-bezel)' }}>
                Desa Bit-Terra tidak bisa dimuat di browser ini. Misi tetap bisa dibuka dari
                daftar — perbaikannya tidak menunggu desa.
              </p>
              <PixelButton variant="copper" onClick={onOpenMissions}>
                Buka Daftar Misi
              </PixelButton>
            </div>
          </NineSlicePanel>
        </div>
      )}

      {/* HUD atas: petunjuk tujuan + fokus */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(430px,72vw)]">
        <NineSlicePanel variant="wood">
          <div className="px-3.5 py-2.5">
            <p className="text-[14px] leading-snug" style={{ color: '#f2ead6' }}>
              {getObjectiveHint(completedQuests)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--bt-sun)' }}
              >
                Fokus
              </span>
              <div
                className="h-2.5 w-28 border"
                style={{ borderColor: 'rgba(0,0,0,0.55)', background: 'rgba(0,0,0,0.35)' }}
                role="progressbar"
                aria-valuenow={focus}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Bar fokus"
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${focus}%`, background: 'var(--bt-sun)' }}
                />
              </div>
              <span className="text-[12px]" style={{ color: '#f2ead6' }}>
                {focus}
              </span>
            </div>
          </div>
        </NineSlicePanel>
      </div>

      {/* HUD atas kanan: Misi + Musik */}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <PixelButton variant="moss" onClick={onOpenMissions}>
          Misi
        </PixelButton>
        <PixelButton variant="slate" onClick={onToggleMusic}>
          {musicOn ? 'Musik: Nyala' : 'Musik: Mati'}
        </PixelButton>
      </div>

      {/* Petunjuk interaksi */}
      {prompt && !dialogue && status === 'ready' && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 sm:bottom-10">
          <div
            className="whitespace-nowrap rounded-[4px] px-3.5 py-2 text-[15px] font-semibold"
            style={{
              background: 'rgba(20,24,32,0.88)',
              color: '#f2ead6',
              border: '2px solid var(--bt-copper)',
              boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
            }}
            role="status"
          >
            {prompt}
            {!isTouch && (
              <span className="ml-2" style={{ color: 'var(--bt-amber)' }}>
                [E]
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dialog NPC / papan */}
      {dialogue && (
        <div className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl p-3 sm:bottom-4">
          <div onClick={advanceDialogue}>
            <DialogueBox
              key={`${dialogue.name}-${dialogue.index}`}
              name={dialogue.name}
              text={dialogue.lines[dialogue.index]}
              onFinished={() => {
                lineDoneRef.current = true;
              }}
            />
          </div>
          <p className="mt-1.5 text-center text-[12px]" style={{ color: 'rgba(242,234,214,0.75)' }}>
            {dialogue.index + 1} dari {dialogue.lines.length} — klik dialog untuk lanjut
          </p>
        </div>
      )}

      {/* Kontrol sentuh */}
      {isTouch && status === 'ready' && (
        <>
          <div
            ref={stickBaseRef}
            className="absolute bottom-5 left-5 z-10 h-28 w-28 rounded-full"
            style={{
              background: 'rgba(20,24,32,0.4)',
              border: '2px solid rgba(216,204,184,0.5)',
              touchAction: 'none',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              updateStick(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) updateStick(e.clientX, e.clientY);
            }}
            onPointerUp={resetStick}
            onPointerCancel={resetStick}
            aria-label="Joystick gerak"
          >
            <div
              className="absolute h-12 w-12 rounded-full"
              style={{
                background: 'rgba(216,204,184,0.75)',
                border: '2px solid rgba(0,0,0,0.5)',
                left: `calc(50% - 24px + ${stick.x * 30}px)`,
                top: `calc(50% - 24px + ${stick.y * 30}px)`,
              }}
            />
          </div>
          <button
            type="button"
            className="absolute bottom-8 right-5 z-10 h-16 w-16 rounded-full text-[15px] font-bold"
            style={{
              background: 'var(--bt-sun)',
              color: 'var(--bt-slate)',
              border: '2px solid rgba(0,0,0,0.55)',
              boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
              touchAction: 'none',
            }}
            onPointerDown={() => {
              worldBridge.touch.interact = true;
            }}
            aria-label="Tombol interaksi"
          >
            Aksi
          </button>
        </>
      )}
    </div>
  );
}

export default WorldScreen;
