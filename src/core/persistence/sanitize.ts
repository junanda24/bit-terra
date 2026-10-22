import type { PersistedProgress } from '../bridge/gameStore';

/**
 * Sanitasi data berbentuk save — SATU rumah untuk pertanyaan "seberapa
 * bersih data ini harus diterima" (audit CORE-M3/L1).
 *
 * Dua tingkat kesengajaan yang berbeda, keduanya dibangun dari per-field
 * sanitizer yang sama:
 * - `sanitizePayloadStrict` — untuk envelope file/DB: SATU field rusak =
 *   seluruh payload ditolak (null). Save yang korup tidak boleh diterapkan
 *   sebagian (perilaku lama saveSystem, dipertahankan).
 * - `sanitizePersistedProgress` — untuk `gameStore.hydrate`: pertahanan
 *   berlapis di batas kepercayaan itu sendiri. Setiap field diperbaiki
 *   sendiri-sendiri (yang rusak → default), tidak pernah melempar.
 *
 * Modul ini tidak mengimpor runtime apa pun dari bridge (hanya tipe) agar
 * tidak ada siklus impor: gameStore & saveSystem sama-sama mengimpor dari
 * sini.
 */

export const FOCUS_MIN = 0;
export const FOCUS_MAX = 100;

/**
 * Jepit fokus ke 0..100. NaN tidak punya jepitan yang bermakna: sebagai
 * jalan terakhir ia memetakan ke 0 — TIDAK PERNAH ke fokus penuh
 * (audit CORE-L1: clampFocus lama mengubah NaN menjadi 100, menghadiahi
 * nilai korup). ±Infinity terjepit ke batas terdekat.
 */
export function clampFocus(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(value)));
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Daftar quest: hanya entri string dari sebuah array; selain itu []. */
export function sanitizeQuestList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is string => typeof q === 'string');
}

/**
 * Peta kode per quest: hanya entri bernilai string. Dibangun dengan
 * Object.fromEntries supaya kunci seperti "__proto__" tetap menjadi
 * properti milik sendiri, bukan polusi prototype.
 */
export function sanitizeCodeMap(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>;
}

/** Fokus: angka finite dijepit; yang lain (string/NaN/null/hilang) → default penuh. */
export function sanitizeFocusValue(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? clampFocus(raw) : FOCUS_MAX;
}

/**
 * Validasi ketat untuk envelope save (file `.bitterra` / baris DB).
 * Mengembalikan payload bersih, atau null bila ADA field yang rusak.
 */
export function sanitizePayloadStrict(raw: unknown): PersistedProgress | null {
  if (!isRecord(raw)) return null;
  const { completedQuests, codeByQuest, focus } = raw;
  if (!Array.isArray(completedQuests) || !completedQuests.every((q) => typeof q === 'string')) {
    return null;
  }
  if (!isRecord(codeByQuest) || !Object.values(codeByQuest).every((c) => typeof c === 'string')) {
    return null;
  }
  if (typeof focus !== 'number' || !Number.isFinite(focus)) return null;
  return {
    completedQuests: [...(completedQuests as string[])],
    codeByQuest: { ...(codeByQuest as Record<string, string>) },
    focus: clampFocus(focus),
  };
}

/**
 * Sanitasi longgar untuk hydrate: tidak pernah melempar, tidak pernah
 * mengembalikan null — field yang rusak diganti default-nya sendiri.
 */
export function sanitizePersistedProgress(raw: unknown): PersistedProgress {
  if (!isRecord(raw)) {
    return { completedQuests: [], codeByQuest: {}, focus: FOCUS_MAX };
  }
  return {
    completedQuests: sanitizeQuestList(raw.completedQuests),
    codeByQuest: sanitizeCodeMap(raw.codeByQuest),
    focus: sanitizeFocusValue(raw.focus),
  };
}
