import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SoundController } from '../../core/audio/SoundController';
import { CARTRIDGE_COLORS, getCartridgeSnippet } from './cartridgeSnippets';

export interface CartridgeBarProps {
  /** Nama cartridge yang sudah terbuka untuk quest aktif. */
  cartridges: string[];
  /** Dipanggil dengan kerangka sintaks yang harus disisipkan ke editor. */
  onInsert: (snippet: string, cartridge: string) => void;
  disabled?: boolean;
}

/**
 * Deretan cartridge sintaks di atas editor. Klik = efek snap fisik (guncang
 * 2px ±80ms + bunyi 'snap') lalu kerangka kodenya masuk ke editor.
 */
export function CartridgeBar({ cartridges, onInsert, disabled = false }: CartridgeBarProps) {
  const [shakeKey, setShakeKey] = useState<Record<string, number>>({});
  const busyRef = useRef(false);

  const handleClick = (name: string) => {
    if (disabled || busyRef.current) return;
    busyRef.current = true;
    setShakeKey((s) => ({ ...s, [name]: (s[name] ?? 0) + 1 }));
    try {
      SoundController.playSFX('snap');
    } catch {
      // Audio belum siap (context suspended) — cartridge tetap berfungsi.
    }
    onInsert(getCartridgeSnippet(name), name);
    window.setTimeout(() => {
      busyRef.current = false;
    }, 120);
  };

  if (cartridges.length === 0) {
    return (
      <div
        className="px-3 py-2 text-[13px]"
        style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
      >
        Belum ada cartridge sintaks. Jelajahi desa — biasanya tersembunyi di tempat yang tidak
        terduga.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 px-3 py-2" role="toolbar" aria-label="Cartridge sintaks">
      {cartridges.map((name, i) => {
        const c = CARTRIDGE_COLORS[i % CARTRIDGE_COLORS.length];
        return (
          <motion.button
            key={`${name}-${shakeKey[name] ?? 0}`}
            type="button"
            disabled={disabled}
            onClick={() => handleClick(name)}
            animate={{ x: [0, -2, 2, -1, 0], y: [0, 1, 0, 0, 0] }}
            transition={{ duration: 0.16, ease: 'linear' }}
            whileHover={disabled ? undefined : { y: -3 }}
            className="relative select-none rounded-[3px] px-3 pb-1.5 pt-2 text-[13px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              fontFamily: "'Pixelify Sans', sans-serif",
              backgroundColor: c.face,
              color: c.text,
              border: '2px solid rgba(0,0,0,0.55)',
              boxShadow: '0 3px 0 rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
            }}
            title={`Sisipkan kerangka ${name}`}
          >
            {/* Takik di bibir atas cartridge */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[3px] block h-[3px] w-8 -translate-x-1/2 rounded-sm bg-black/30"
            />
            {name}
          </motion.button>
        );
      })}
    </div>
  );
}

export default CartridgeBar;
