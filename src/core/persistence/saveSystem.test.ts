import { describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  flushSave,
  inspectEnvelope,
  installFlushOnHide,
  parseSaveText,
  quarantineRaw,
  save,
  validateEnvelope,
  type KeyValueStorage,
  type SavePayload,
} from './saveSystem';

const samplePayload: SavePayload = {
  completedQuests: ['q1-bangun-piko'],
  codeByQuest: { 'q1-bangun-piko': 'piko.boot();' },
  focus: 80,
};

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('save envelope', () => {
  it('round-trips: buildEnvelope -> validateEnvelope returns the same payload', () => {
    const env = buildEnvelope(samplePayload);
    expect(env.version).toBe(1);
    expect(typeof env.savedAt).toBe('string');
    const back = validateEnvelope(JSON.parse(JSON.stringify(env)));
    expect(back).not.toBeNull();
    expect(back?.payload).toEqual(samplePayload);
  });

  it('clamps out-of-range focus instead of rejecting the save', () => {
    const env = buildEnvelope({ ...samplePayload, focus: 250 });
    expect(env.payload.focus).toBe(100);
    const env2 = buildEnvelope({ ...samplePayload, focus: -5 });
    expect(env2.payload.focus).toBe(0);
  });

  it('rejects non-objects and wrong shapes', () => {
    expect(validateEnvelope(null)).toBeNull();
    expect(validateEnvelope('nope')).toBeNull();
    expect(validateEnvelope({ version: 1, savedAt: 'x', payload: null })).toBeNull();
    expect(
      validateEnvelope({
        version: 1,
        savedAt: 'x',
        payload: { completedQuests: [42], codeByQuest: {}, focus: 10 },
      }),
    ).toBeNull();
    expect(
      validateEnvelope({
        version: 1,
        savedAt: 'x',
        payload: { completedQuests: [], codeByQuest: { q: 7 }, focus: 10 },
      }),
    ).toBeNull();
    expect(
      validateEnvelope({
        version: 1,
        savedAt: 'x',
        payload: { completedQuests: [], codeByQuest: {}, focus: Number.NaN },
      }),
    ).toBeNull();
  });

  it('flags unknown versions as version errors, not corruption', () => {
    const r = inspectEnvelope({ version: 99, savedAt: 'x', payload: samplePayload });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('version');
    const parsed = parseSaveText(
      JSON.stringify({ version: 99, savedAt: 'x', payload: samplePayload }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('Versi');
  });

  it('parseSaveText: valid JSON passes, broken JSON gives an Indonesian error', () => {
    const ok = parseSaveText(JSON.stringify(buildEnvelope(samplePayload)));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.envelope.payload).toEqual(samplePayload);
    const bad = parseSaveText('{bukan json');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('tidak bisa dibaca');
  });
});

describe('quarantine', () => {
  it('copies raw data under a bitterra:quarantine:<ISO> key and returns it', () => {
    const storage = memoryStorage();
    const key = quarantineRaw('{"version":99}', storage);
    expect(key).not.toBeNull();
    expect(key?.startsWith('bitterra:quarantine:')).toBe(true);
    expect(storage.map.get(key!)).toBe('{"version":99}');
  });

  it('returns null (never throws) when storage is unavailable or full', () => {
    expect(quarantineRaw('x', null)).toBeNull();
    const throwing: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(quarantineRaw('x', throwing)).toBeNull();
  });
});

describe('flushSave + installFlushOnHide (CORE-M2)', () => {
  class FakeTarget {
    visibilityState = 'visible';
    private listeners = new Map<string, Set<() => void>>();
    addEventListener(type: string, fn: () => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(fn);
    }
    removeEventListener(type: string, fn: () => void) {
      this.listeners.get(type)?.delete(fn);
    }
    fire(type: string) {
      for (const fn of this.listeners.get(type) ?? []) fn();
    }
    count(type: string) {
      return this.listeners.get(type)?.size ?? 0;
    }
  }

  it('flushSave with nothing pending resolves true; a pending payload is attempted then consumed', async () => {
    await expect(flushSave()).resolves.toBe(true);
    save(samplePayload);
    // Node has no IndexedDB, so the write attempt itself fails (false) —
    // exactly the observable the audit probe used to prove a pending
    // payload really was waiting unsaved.
    await expect(flushSave()).resolves.toBe(false);
    await expect(flushSave()).resolves.toBe(true); // consumed
  });

  it('pagehide flushes the pending payload; uninstall stops the wiring', async () => {
    const win = new FakeTarget();
    const doc = new FakeTarget();
    const uninstall = installFlushOnHide({ win, doc });
    expect(win.count('pagehide')).toBe(1);
    expect(win.count('beforeunload')).toBe(1);
    expect(doc.count('visibilitychange')).toBe(1);

    save(samplePayload);
    win.fire('pagehide');
    await expect(flushSave()).resolves.toBe(true); // listener consumed it

    uninstall();
    expect(win.count('pagehide')).toBe(0);
    save(samplePayload);
    win.fire('pagehide'); // no listener anymore
    await expect(flushSave()).resolves.toBe(false); // still pending until WE flush
  });

  it('visibilitychange flushes only when hidden; beforeunload flushes too', async () => {
    const win = new FakeTarget();
    const doc = new FakeTarget();
    const uninstall = installFlushOnHide({ win, doc });

    save(samplePayload);
    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    await expect(flushSave()).resolves.toBe(false); // still pending (this flush attempt drains it)

    save(samplePayload);
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    await expect(flushSave()).resolves.toBe(true); // listener consumed it

    save(samplePayload);
    win.fire('beforeunload');
    await expect(flushSave()).resolves.toBe(true);
    uninstall();
  });
});
