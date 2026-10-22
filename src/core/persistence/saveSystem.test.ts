import { describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  inspectEnvelope,
  parseSaveText,
  quarantineRaw,
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
