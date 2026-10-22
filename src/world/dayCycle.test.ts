/**
 * Tes fungsi murni siklus siang (Fase 4): keyframe, interpolasi, batas
 * alpha, kontinuitas wrap, dan pembekuan reduced-motion.
 */
import { describe, expect, it } from 'vitest';
import { DAY_CYCLE_MS, MAX_TINT_ALPHA, REDUCED_MOTION_TINT, dayTintAt } from './dayCycle';

const at = (t: number) => dayTintAt(t * DAY_CYCLE_MS);

describe('dayTintAt — keyframe', () => {
  it('t=0 adalah pagi: emas #e9a13b, alpha 0.10', () => {
    const tint = at(0);
    expect(tint.color).toBe(0xe9a13b);
    expect(tint.alpha).toBeCloseTo(0.1, 6);
  });

  it('siang (t=0.34) jernih total: alpha 0', () => {
    expect(at(0.34).alpha).toBeCloseTo(0, 6);
  });

  it('senja (t=0.74) amber #e2703a alpha 0.17; petang (t=0.88) biru #46639b alpha 0.22', () => {
    const dusk = at(0.74);
    expect(dusk.color).toBe(0xe2703a);
    expect(dusk.alpha).toBeCloseTo(0.17, 6);
    const evening = at(0.88);
    expect(evening.color).toBe(0x46639b);
    expect(evening.alpha).toBeCloseTo(0.22, 6);
  });

  it('interpolasi linear di tengah segmen pagi -> menjelang siang', () => {
    const mid = at(0.09); // separuh jalan 0.00 -> 0.18
    expect(mid.alpha).toBeCloseTo(0.075, 6);
    // Titik tengah #e9a13b (233,161,59) dan #f6c177 (246,193,119).
    expect(mid.r).toBe(240); // 239.5 dibulatkan
    expect(mid.g).toBe(177);
    expect(mid.b).toBe(89);
  });
});

describe('dayTintAt — batas & kontinuitas', () => {
  it('alpha tidak pernah melewati MAX_TINT_ALPHA dan tidak pernah negatif', () => {
    for (let i = 0; i <= 2000; i++) {
      const tint = dayTintAt((i / 2000) * DAY_CYCLE_MS);
      expect(tint.alpha).toBeLessThanOrEqual(MAX_TINT_ALPHA + 1e-9);
      expect(tint.alpha).toBeGreaterThanOrEqual(0);
    }
  });

  it('membungkus: tint tepat di DAY_CYCLE_MS sama dengan t=0, dan sesaat sebelumnya nyaris sama', () => {
    expect(dayTintAt(DAY_CYCLE_MS)).toEqual(dayTintAt(0));
    const before = dayTintAt(DAY_CYCLE_MS - 16);
    const start = dayTintAt(0);
    expect(Math.abs(before.alpha - start.alpha)).toBeLessThan(0.01);
    expect(Math.abs(before.r - start.r)).toBeLessThan(6);
    expect(Math.abs(before.g - start.g)).toBeLessThan(6);
    expect(Math.abs(before.b - start.b)).toBeLessThan(6);
  });

  it('elapsed negatif diperlakukan sebagai posisi yang sama dalam putaran', () => {
    expect(dayTintAt(-1)).toEqual(dayTintAt(DAY_CYCLE_MS - 1));
  });

  it('beberapa putaran penuh kembali ke tint yang sama', () => {
    expect(dayTintAt(3 * DAY_CYCLE_MS + 0.5 * DAY_CYCLE_MS)).toEqual(at(0.5));
  });
});

describe('dayTintAt — reduced motion', () => {
  it('membeku di tint pagi yang sama untuk semua waktu', () => {
    for (const ms of [0, 1_000, 0.5 * DAY_CYCLE_MS, 0.88 * DAY_CYCLE_MS, 9 * DAY_CYCLE_MS]) {
      expect(dayTintAt(ms, true)).toEqual(REDUCED_MOTION_TINT);
    }
    expect(REDUCED_MOTION_TINT.alpha).toBe(0.06);
  });
});
