import Dexie, { type Table } from 'dexie';
import { clampFocus, type PersistedProgress } from '../bridge/gameStore';

/**
 * Save system — Dexie (IndexedDB) + versioned envelope + `.bitterra`
 * export/import (docs/BLUEPRINT.md §5, §7 self-healing).
 *
 * Failure contract: NOTHING in this module throws to the caller. Bad data is
 * quarantined (raw copy under a localStorage `bitterra:quarantine:<ISO>` key)
 * and the load simply returns null — the game starts fresh instead of dying.
 */

export type SavePayload = PersistedProgress;

export interface SaveEnvelope {
  version: 1;
  savedAt: string;
  payload: SavePayload;
}

export const SAVE_VERSION = 1 as const;
export const SAVE_ROW_ID = 'autosave';
const QUARANTINE_PREFIX = 'bitterra:quarantine:';
const SAVE_DEBOUNCE_MS = 800;

/* ------------------------------------------------------------------ */
/* Pure envelope helpers (unit-tested)                                 */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizePayload(raw: unknown): SavePayload | null {
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

/** Build a fresh, sanitized envelope around a payload. */
export function buildEnvelope(payload: SavePayload): SaveEnvelope {
  const clean = sanitizePayload(payload) ?? { completedQuests: [], codeByQuest: {}, focus: 100 };
  return { version: SAVE_VERSION, savedAt: new Date().toISOString(), payload: clean };
}

type InspectResult =
  | { ok: true; envelope: SaveEnvelope }
  | { ok: false; reason: 'version' | 'corrupt' };

/** Validate an unknown value as a save envelope. Never throws. */
export function inspectEnvelope(raw: unknown): InspectResult {
  if (!isRecord(raw)) return { ok: false, reason: 'corrupt' };
  if (raw.version !== SAVE_VERSION) {
    // A numeric version that is not ours = a save from another build: callers
    // must quarantine, not try to interpret it.
    return { ok: false, reason: typeof raw.version === 'number' ? 'version' : 'corrupt' };
  }
  if (typeof raw.savedAt !== 'string') return { ok: false, reason: 'corrupt' };
  const payload = sanitizePayload(raw.payload);
  if (!payload) return { ok: false, reason: 'corrupt' };
  return { ok: true, envelope: { version: SAVE_VERSION, savedAt: raw.savedAt, payload } };
}

/** Validate an unknown value; returns the envelope or null. Never throws. */
export function validateEnvelope(raw: unknown): SaveEnvelope | null {
  const r = inspectEnvelope(raw);
  return r.ok ? r.envelope : null;
}

/** Parse `.bitterra` file text. Indonesian error strings, never throws. */
export function parseSaveText(
  text: string,
): { ok: true; envelope: SaveEnvelope } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File save tidak bisa dibaca (bukan JSON yang valid).' };
  }
  const r = inspectEnvelope(parsed);
  if (!r.ok) {
    return {
      ok: false,
      error:
        r.reason === 'version'
          ? 'Versi file save tidak dikenal — file ini mungkin dari versi Bit-Terra lain.'
          : 'Isi file save rusak atau tidak lengkap, jadi tidak bisa dimuat.',
    };
  }
  return { ok: true, envelope: r.envelope };
}

/* ------------------------------------------------------------------ */
/* Quarantine                                                          */
/* ------------------------------------------------------------------ */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Copy raw (untrusted) save data aside for later inspection.
 * Returns the quarantine key, or null when no storage is available.
 * Never throws.
 */
export function quarantineRaw(
  rawText: string,
  storage: KeyValueStorage | null = defaultStorage(),
): string | null {
  if (!storage) return null;
  const key = `${QUARANTINE_PREFIX}${new Date().toISOString()}`;
  try {
    storage.setItem(key, rawText);
    return key;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Dexie storage                                                       */
/* ------------------------------------------------------------------ */

interface SaveRow {
  id: string;
  envelope: SaveEnvelope;
}

class BitTerraDb extends Dexie {
  saves!: Table<SaveRow, string>;

  constructor() {
    super('bit-terra');
    this.version(1).stores({ saves: 'id' });
  }
}

let db: BitTerraDb | null = null;
function getDb(): BitTerraDb {
  if (!db) db = new BitTerraDb();
  return db;
}

let lastPayload: SavePayload | null = null;

/** Write the payload right now. Returns success; never throws. */
export async function saveNow(payload: SavePayload): Promise<boolean> {
  try {
    const envelope = buildEnvelope(payload);
    await getDb().saves.put({ id: SAVE_ROW_ID, envelope });
    lastPayload = envelope.payload;
    return true;
  } catch {
    return false;
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPayload: SavePayload | null = null;

/** Debounced autosave helper (trailing edge, 800 ms). Fire-and-forget. */
export function save(payload: SavePayload): void {
  pendingPayload = payload;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const p = pendingPayload;
    pendingPayload = null;
    if (p) void saveNow(p);
  }, SAVE_DEBOUNCE_MS);
}

/** Force any pending debounced save to disk now. */
export async function flushSave(): Promise<boolean> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const p = pendingPayload;
  pendingPayload = null;
  if (!p) return true;
  return saveNow(p);
}

/**
 * Load the autosaved progress. Returns null when there is no save, the DB is
 * unavailable, or the data is unusable (in which case the raw data is
 * quarantined first). Never throws, never partially applies.
 */
export async function load(): Promise<SavePayload | null> {
  let row: SaveRow | undefined;
  try {
    row = await getDb().saves.get(SAVE_ROW_ID);
  } catch {
    return null;
  }
  if (!row) return null;
  const r = inspectEnvelope(row.envelope);
  if (!r.ok) {
    quarantineRaw(JSON.stringify(row.envelope ?? row));
    return null;
  }
  lastPayload = r.envelope.payload;
  return r.envelope.payload;
}

/** Delete the autosave (used by a future "mulai dari awal" flow). */
export async function clearSave(): Promise<boolean> {
  try {
    await getDb().saves.delete(SAVE_ROW_ID);
    lastPayload = null;
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Export / import `.bitterra`                                         */
/* ------------------------------------------------------------------ */

/**
 * Download the current progress as a `.bitterra` JSON file.
 * Uses the given payload, else the last known one, else the stored save.
 * Returns the file name, or null when export is impossible here.
 */
export async function exportSave(payload?: SavePayload): Promise<string | null> {
  try {
    const data = payload ?? lastPayload ?? (await load());
    if (!data) return null;
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    const envelope = buildEnvelope(data);
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = envelope.savedAt.slice(0, 10);
    const fileName = `bit-terra-save-${stamp}.bitterra`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return fileName;
  } catch {
    return null;
  }
}

/**
 * Import a `.bitterra` file: parse + validate, then persist and return the
 * payload. On any problem returns an Indonesian error string; the existing
 * save is left untouched. Never throws.
 */
export async function importSave(
  file: File,
): Promise<{ ok: true; payload: SavePayload } | { ok: false; error: string }> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'File save tidak bisa dibaca.' };
  }
  const parsed = parseSaveText(text);
  if (!parsed.ok) {
    // A foreign/corrupt file is evidence, not trash — keep a copy aside.
    quarantineRaw(text);
    return { ok: false, error: parsed.error };
  }
  const written = await saveNow(parsed.envelope.payload);
  if (!written) {
    return { ok: false, error: 'Save valid, tapi penyimpanan browser menolak menulisnya.' };
  }
  return { ok: true, payload: parsed.envelope.payload };
}
