import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import {
  FOCUS_REST_CAP,
  FOCUS_REST_PER_TICK,
  restedFocus,
  tickFocusRest,
} from './focusRest';
import { FOCUS_FAIL_COST, FOCUS_SUCCESS_REWARD } from '../../ui/cyberdeck/focusPolicy';

/**
 * Balance pass Fase 4 — ekonomi Fokus (Brain Fog) di seluruh graf 8 quest.
 *
 * Aturan terkirim yang dimodelkan persis dari kode:
 * - Fokus mulai 100 (FOCUS_MAX, gameStore).
 * - Gagal RUN memotong −10 HANYA bila kode sudah diubah dari kerangka DAN
 *   linter bersih saat RUN (focusPolicy.shouldDeductFocusOnFail); sisanya
 *   gratis: tarikan kerangka (F-09), error yang sudah diperingatkan linter
 *   + gerbang RUN (F-04/F-07), error runtime SQL (SQL-M1), run
 *   terkontaminasi rollback (SQL-H1), watchdog bot.
 * - Sukses: +20 HANYA penyelesaian pertama (completeQuest → boolean).
 * - Tidak ada gerbang keras di fokus berapa pun (tidak ada kode yang
 *   menonaktifkan RUN berdasarkan fokus) — jadi "terjebak" di sini
 *   bersifat lunak: bar terparkir merah dan satu-satunya pemulihan
 *   (pra-perbaikan) adalah sukses di quest yang sedang menjebakmu.
 * - Perbaikan yang diuji di sini: istirahat di desa memulihkan sampai
 *   FOCUS_REST_CAP selama deck tertutup (focusRest.tickFocusRest).
 */

describe('restedFocus — fungsi murni batas istirahat', () => {
  it('naik per ketukan dan berhenti tepat di batas istirahat', () => {
    expect(restedFocus(0)).toBe(FOCUS_REST_PER_TICK);
    expect(restedFocus(FOCUS_REST_CAP - 1)).toBe(FOCUS_REST_CAP);
    expect(restedFocus(0, 100)).toBe(FOCUS_REST_CAP);
  });

  it('tidak pernah menggerakkan fokus di atas batas (hasil quest aman)', () => {
    expect(restedFocus(FOCUS_REST_CAP)).toBe(FOCUS_REST_CAP);
    expect(restedFocus(80)).toBe(80);
    expect(restedFocus(100)).toBe(100);
  });
});

describe('tickFocusRest — ketukan terhadap store sungguhan', () => {
  beforeEach(() => {
    useGameStore.setState({ focus: 0, codingMode: false, completedQuests: [] });
  });

  it('di desa (deck tertutup): fokus pulih per ketukan sampai batas', () => {
    expect(tickFocusRest()).toBe(true);
    expect(useGameStore.getState().focus).toBe(FOCUS_REST_PER_TICK);
    for (let i = 0; i < 40; i++) tickFocusRest();
    expect(useGameStore.getState().focus).toBe(FOCUS_REST_CAP);
    // Sudah di batas: ketukan berikutnya no-op jujur.
    expect(tickFocusRest()).toBe(false);
  });

  it('di deck (codingMode): tidak ada istirahat — pemain sedang ngoding', () => {
    useGameStore.setState({ codingMode: true });
    expect(tickFocusRest()).toBe(false);
    expect(useGameStore.getState().focus).toBe(0);
  });

  it('fokus hasil quest di atas batas tidak ikut naik maupun turun', () => {
    useGameStore.setState({ focus: 90 });
    expect(tickFocusRest()).toBe(false);
    expect(useGameStore.getState().focus).toBe(90);
  });
});

/* ---------------- simulasi ekonomi 1000 sesi ---------------- */

/** PRNG deterministik (mulberry32) — simulasi bisa diulang persis. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  name: string;
  /** Rentang gagal-RUN (yang memenuhi syarat pajak) sebelum sukses, per quest. */
  failsMin: number;
  failsMax: number;
}

const PROFILES: Profile[] = [
  { name: 'P25 santai', failsMin: 0, failsMax: 1 },
  { name: 'P50 anak tipikal', failsMin: 1, failsMax: 3 },
  { name: 'P75 berjuang', failsMin: 3, failsMax: 6 },
  { name: 'P95 berjuang berat', failsMin: 6, failsMax: 10 },
];

/** Peluang satu gagal-RUN ternyata GRATIS (kelas bebas pajak F-04/F-09:
 * kerangka belum disentuh, sudah diperingatkan linter, error runtime SQL,
 * rollback, watchdog). Dari transkrip playtest ronde 1: ±sepertiga
 * kesalahan pemula jatuh ke kelas-kelas ini. */
const FREE_FAIL_PROBABILITY = 0.35;

const QUEST_COUNT = 8;

interface SessionStats {
  minFocus: number;
  hitZero: boolean;
  endFocus: number;
  questStarts: number[];
}

function simulateSession(
  rng: () => number,
  profile: Profile,
  withVillageRest: boolean,
): SessionStats {
  let focus = 100;
  let minFocus = focus;
  let hitZero = false;
  const questStarts: number[] = [];
  for (let q = 0; q < QUEST_COUNT; q++) {
    if (withVillageRest) {
      // Pemain kembali ke desa di antara quest: istirahat tersedia dan
      // dipakai sampai batas sebelum quest berikutnya (jalan pulang
      // yang TIDAK mensyaratkan sukses — inti perbaikan ini).
      focus = Math.max(focus, restedFocus(focus, Number.MAX_SAFE_INTEGER));
    }
    questStarts.push(focus);
    const fails =
      profile.failsMin +
      Math.floor(rng() * (profile.failsMax - profile.failsMin + 1));
    for (let f = 0; f < fails; f++) {
      if (rng() < FREE_FAIL_PROBABILITY) continue; // gagal gratis
      focus = Math.max(0, focus - FOCUS_FAIL_COST);
      if (focus === 0) hitZero = true;
      minFocus = Math.min(minFocus, focus);
    }
    focus = Math.min(100, focus + FOCUS_SUCCESS_REWARD);
  }
  return { minFocus, hitZero, endFocus: focus, questStarts };
}

function simulateProfile(profile: Profile, withVillageRest: boolean, seed: number) {
  const rng = mulberry32(seed);
  const sessions: SessionStats[] = [];
  for (let i = 0; i < 1000; i++) sessions.push(simulateSession(rng, profile, withVillageRest));
  const hitZeroRate = sessions.filter((s) => s.hitZero).length / sessions.length;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return {
    hitZeroRate,
    medianMinFocus: median(sessions.map((s) => s.minFocus)),
    medianEndFocus: median(sessions.map((s) => s.endFocus)),
    lowestQuestStart: Math.min(...sessions.flatMap((s) => s.questStarts)),
  };
}

describe('simulasi ekonomi Fokus — 1000 sesi per profil', () => {
  it('TANPA istirahat desa: pemain berjuang berat terparkir di nol (soft-strand terbukti)', () => {
    const p95 = simulateProfile(PROFILES[3], false, 95);
    // Mayoritas sesi P95 menyentuh fokus 0 di suatu titik…
    expect(p95.hitZeroRate).toBeGreaterThan(0.5);
    // …dan median fokus akhirnya pas-pasan: satu-satunya pemulihan
    // adalah +20 sukses yang baru saja diraih — tidak ada jalan lain.
    expect(p95.medianEndFocus).toBeLessThanOrEqual(40);
    // eslint-disable-next-line no-console
    console.log('[balance] P95 tanpa istirahat:', p95);
  });

  it('DENGAN istirahat desa: tidak ada quest yang dimulai di bawah batas istirahat', () => {
    for (const [i, profile] of PROFILES.entries()) {
      const stats = simulateProfile(profile, true, 1000 + i);
      // Properti anti-terjebak: apa pun yang terjadi di quest lalu,
      // quest berikutnya SELALU bisa dimulai dari fokus istirahat penuh
      // (atau lebih tinggi, bila hasil quest membawanya ke sana) —
      // pemulihan tidak lagi mensyaratkan sukses.
      expect(stats.lowestQuestStart, profile.name).toBeGreaterThanOrEqual(FOCUS_REST_CAP);
      // eslint-disable-next-line no-console
      console.log(`[balance] ${profile.name} dengan istirahat:`, stats);
    }
  });

  it('profil santai/tipikal tidak pernah menyentuh nol di kedua rezim', () => {
    for (const withRest of [false, true]) {
      const p25 = simulateProfile(PROFILES[0], withRest, 25);
      const p50 = simulateProfile(PROFILES[1], withRest, 50);
      expect(p25.hitZeroRate).toBe(0);
      expect(p50.hitZeroRate).toBe(0);
    }
  });
});
