import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface TypingParticleCanvasHandle {
  /** Semburkan 3–5 partikel pixel di koordinat (x, y) relatif terhadap canvas. */
  spawnBurst: (x: number, y: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: string;
}

const COLORS = ['#ffb000', '#00f5d4', '#f4b41b', '#ffd489'];
const LIFE_MS = 300;
const GRAVITY = 1500; // px / s^2

/**
 * Lapisan partikel di atas editor: setiap ketukan memercikkan pixel 3x3px
 * amber/cyan yang memantul karena gravitasi dan padam dalam 300ms
 * (BLUEPRINT §6 typing juice). Loop rAF hanya berjalan saat ada partikel.
 */
export const TypingParticleCanvas = forwardRef<
  TypingParticleCanvasHandle,
  { className?: string }
>(function TypingParticleCanvas({ className = '' }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => {
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
    };
  }, []);

  const tick = (now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      rafRef.current = null;
      return;
    }
    const { w, h, dpr } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const dt = 1 / 60;
    particlesRef.current = particlesRef.current.filter((p) => now - p.born < p.life);
    for (const p of particlesRef.current) {
      const age = (now - p.born) / 1000;
      void age;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // memantul di lantai canvas
      if (p.y > h - 3) {
        p.y = h - 3;
        p.vy *= -0.45;
        p.vx *= 0.8;
      }
      if (p.x < 0) {
        p.x = 0;
        p.vx *= -0.6;
      } else if (p.x > w - 3) {
        p.x = w - 3;
        p.vx *= -0.6;
      }
      const remain = 1 - (now - p.born) / p.life;
      ctx.globalAlpha = Math.max(0, remain);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    ctx.globalAlpha = 1;
    if (particlesRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
      rafRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    spawnBurst(x: number, y: number) {
      const count = 3 + Math.floor(Math.random() * 3); // 3–5 partikel
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
        const speed = 60 + Math.random() * 130;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          born: now,
          life: LIFE_MS,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-30 ${className}`}
    />
  );
});

export default TypingParticleCanvas;
