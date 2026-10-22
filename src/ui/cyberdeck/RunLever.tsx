import { useRef } from 'react';
import { motion } from 'framer-motion';
import { eventBus } from '../../core/bridge/eventBus';
import { SoundController } from '../../core/audio/SoundController';

export interface RunLeverProps {
  questId: string;
  disabled?: boolean;
}

/**
 * Tuas RUN fisik di rel kanan Cyber-Deck. Tarik ke bawah (atau klik) untuk
 * menembakkan EXECUTE_CODE ke eventBus — bunyi mekanis berat menyertai.
 */
export function RunLever({ questId, disabled = false }: RunLeverProps) {
  const lastDragFireRef = useRef(0);

  const fire = () => {
    if (disabled) return;
    try {
      SoundController.playSFX('lever');
    } catch {
      // Audio belum siap — tuas tetap berfungsi.
    }
    eventBus.emit('EXECUTE_CODE', { questId });
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* rel tuas */}
      <div
        className="relative flex w-[46px] justify-center rounded-full pt-2"
        style={{
          height: 148,
          backgroundColor: '#10131a',
          border: '2px solid rgba(0,0,0,0.6)',
          boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.85), inset 0 -2px 3px rgba(255,255,255,0.08)',
        }}
      >
        <div
          aria-hidden
          className="absolute left-1/2 top-3 h-[104px] w-[6px] -translate-x-1/2 rounded-full"
          style={{ backgroundColor: '#05070a', boxShadow: 'inset 0 1px 3px #000' }}
        />
        <motion.div
          role="button"
          aria-label="Tarik untuk menjalankan kode"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          drag={disabled ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 62 }}
          dragElastic={0.12}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (info.offset.y > 34) {
              lastDragFireRef.current = Date.now();
              fire();
            }
          }}
          onClick={() => {
            // Klik tepat setelah drag tidak boleh menembak dua kali.
            if (Date.now() - lastDragFireRef.current < 350) return;
            fire();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fire();
            }
          }}
          whileHover={disabled ? undefined : { scale: 1.05 }}
          className={`relative z-10 flex flex-col items-center outline-none ${
            disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          {/* batang tuas */}
          <span
            aria-hidden
            className="block h-[38px] w-[7px]"
            style={{
              background: 'linear-gradient(90deg, #6f6450, #d8ccb8 45%, #6f6450)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          />
          {/* kenop tembaga */}
          <span
            aria-hidden
            className="block h-[34px] w-[34px] rounded-full"
            style={{
              background:
                'radial-gradient(circle at 34% 28%, #ffd9a8 0%, #c87d55 48%, #8a4f30 100%)',
              border: '2px solid #5d3319',
              boxShadow: '0 4px 6px rgba(0,0,0,0.55), inset 0 -3px 5px rgba(0,0,0,0.35)',
            }}
          />
        </motion.div>
      </div>
      <span
        className="text-[11px] tracking-[0.2em]"
        style={{ fontFamily: "'Press Start 2P', monospace", color: '#141820' }}
      >
        RUN
      </span>
      <span
        className="-mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
        style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#5d5142' }}
      >
        tarik tuasnya
      </span>
    </div>
  );
}

export default RunLever;
