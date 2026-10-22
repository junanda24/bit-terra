/**
 * Siklus siang Desa Bit-Terra (Fase 4) — fungsi MURNI, tanpa Phaser.
 *
 * Satu putaran penuh = 5 menit waktu nyata. Desa tidak pernah gelap
 * total: petang berhenti di biru lembut (alpha maksimum 0.22) supaya
 * anak selalu bisa membaca peta dan bermain — "playability first".
 * Bentuknya keyframe warna+alpha yang diinterpolasi linear dan membungkus
 * (wrap) dari petang kembali ke pagi.
 *
 * VillageScene mengambil waktu dari jam scene (this.time.now), yang
 * membeku saat scene di-pause (deck terbuka / dialog) — jadi siklus ikut
 * berhenti dengan sopan, bukan melompat saat pemain kembali.
 *
 * prefers-reduced-motion: tint dibekukan di "pagi menjelang siang" yang
 * menyenangkan — desa diam, tidak berdenyut.
 */

export const DAY_CYCLE_MS = 300_000; // 5 menit per putaran penuh

/** Batas keras kekuatan tint — petang pun tidak boleh lebih gelap dari ini. */
export const MAX_TINT_ALPHA = 0.22;

export interface DayTint {
  /** Warna Phaser 0xRRGGBB. */
  color: number;
  r: number;
  g: number;
  b: number;
  /** 0 = jernih total, MAX_TINT_ALPHA = petang tergelap. */
  alpha: number;
}

interface TintKeyframe {
  /** Posisi dalam putaran, 0..1. */
  t: number;
  color: string; // '#rrggbb'
  alpha: number;
}

const KEYFRAMES: readonly TintKeyframe[] = [
  { t: 0.0, color: '#e9a13b', alpha: 0.1 }, // pagi — emas lembut
  { t: 0.18, color: '#f6c177', alpha: 0.05 }, // menjelang siang
  { t: 0.34, color: '#ffffff', alpha: 0.0 }, // siang — jernih total
  { t: 0.56, color: '#ffc27d', alpha: 0.06 }, // sore — hangat tipis
  { t: 0.74, color: '#e2703a', alpha: 0.17 }, // senja — amber
  { t: 0.88, color: '#46639b', alpha: 0.22 }, // petang — biru lembut (tergelap)
];

/** Tint beku untuk prefers-reduced-motion: pagi menjelang siang. */
export const REDUCED_MOTION_TINT: DayTint = tintFromHex('#f2b95e', 0.06);

function tintFromHex(hex: string, alpha: number): DayTint {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { color: (r << 16) | (g << 8) | b, r, g, b, alpha };
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function lerpTint(a: TintKeyframe, b: TintKeyframe, f: number): DayTint {
  const ta = tintFromHex(a.color, a.alpha);
  const tb = tintFromHex(b.color, b.alpha);
  const r = Math.round(lerp(ta.r, tb.r, f));
  const g = Math.round(lerp(ta.g, tb.g, f));
  const bl = Math.round(lerp(ta.b, tb.b, f));
  return {
    color: (r << 16) | (g << 8) | bl,
    r,
    g,
    b: bl,
    alpha: lerp(ta.alpha, tb.alpha, f),
  };
}

/**
 * Tint desa pada `elapsedMs` sejak desa dimuat (jam scene — membeku saat
 * pause). `reducedMotion` membekukan siklus di REDUCED_MOTION_TINT.
 */
export function dayTintAt(elapsedMs: number, reducedMotion = false): DayTint {
  if (reducedMotion) return REDUCED_MOTION_TINT;
  const cycle = ((elapsedMs % DAY_CYCLE_MS) + DAY_CYCLE_MS) % DAY_CYCLE_MS;
  const t = cycle / DAY_CYCLE_MS;
  // Cari segmen keyframe yang memuat t; segmen terakhir membungkus dari
  // keyframe petang (0.88) ke keyframe pagi (t=1 ≡ 0).
  for (let i = 0; i < KEYFRAMES.length; i++) {
    const from = KEYFRAMES[i];
    const to = KEYFRAMES[(i + 1) % KEYFRAMES.length];
    const fromT = from.t;
    const toT = i === KEYFRAMES.length - 1 ? 1 : to.t;
    if (t >= fromT && t <= toT) {
      const span = toT - fromT;
      const f = span <= 0 ? 0 : (t - fromT) / span;
      return lerpTint(from, to, f);
    }
  }
  return tintFromHex(KEYFRAMES[0].color, KEYFRAMES[0].alpha);
}
