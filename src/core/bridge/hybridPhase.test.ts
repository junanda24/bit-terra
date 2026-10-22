import { beforeEach, describe, expect, it } from 'vitest';
import { selectPersistedProgress, useGameStore, type PersistedProgress } from './gameStore';
import {
  isValidHybridPhaseMap,
  sanitizeHybridPhaseMap,
  sanitizePayloadStrict,
  sanitizePersistedProgress,
} from '../persistence/sanitize';
import { buildEnvelope, validateEnvelope } from '../persistence/saveSystem';
import {
  planHybridReopen,
  resolveHybridReplay,
  savedHybridPhase,
} from '../../ui/cyberdeck/hybridLogic';

const Q8 = 'quest_08_great_commit';

beforeEach(() => {
  useGameStore.setState({
    completedQuests: [],
    codeByQuest: {},
    focus: 100,
    hybridPhaseByQuest: {},
    pikoLine: null,
  });
});

describe('sanitizeHybridPhaseMap (PT2-F6)', () => {
  it('hanya entri bernilai persis 2 yang bertahan', () => {
    expect(sanitizeHybridPhaseMap({ [Q8]: 2 })).toEqual({ [Q8]: 2 });
    expect(
      sanitizeHybridPhaseMap({ [Q8]: 2, q1: 1, q2: '2', q3: true, q4: null }),
    ).toEqual({ [Q8]: 2 });
  });

  it('bukan record → peta kosong', () => {
    expect(sanitizeHybridPhaseMap('abc')).toEqual({});
    expect(sanitizeHybridPhaseMap(null)).toEqual({});
    expect(sanitizeHybridPhaseMap([2])).toEqual({});
    expect(sanitizeHybridPhaseMap(undefined)).toEqual({});
  });

  it('kunci "__proto__" menjadi properti sendiri, bukan polusi prototype', () => {
    const raw = JSON.parse('{"__proto__": 2}') as unknown;
    const clean = sanitizeHybridPhaseMap(raw);
    expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(clean)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('isValidHybridPhaseMap (gerbang ketat)', () => {
  it('record yang semua nilainya 2 sah; sisanya tidak', () => {
    expect(isValidHybridPhaseMap({})).toBe(true);
    expect(isValidHybridPhaseMap({ [Q8]: 2 })).toBe(true);
    expect(isValidHybridPhaseMap({ [Q8]: 1 })).toBe(false);
    expect(isValidHybridPhaseMap('x')).toBe(false);
  });
});

describe('sanitizePayloadStrict — field fase opsional', () => {
  const base = { completedQuests: [] as string[], codeByQuest: {} as Record<string, string>, focus: 50 };

  it('save lama tanpa field: sah, terisi peta kosong', () => {
    const clean = sanitizePayloadStrict(base);
    expect(clean).not.toBeNull();
    expect(clean!.hybridPhaseByQuest).toEqual({});
  });

  it('field valid dipertahankan apa adanya', () => {
    const clean = sanitizePayloadStrict({ ...base, hybridPhaseByQuest: { [Q8]: 2 } });
    expect(clean!.hybridPhaseByQuest).toEqual({ [Q8]: 2 });
  });

  it('field hadir tapi rusak: seluruh payload ditolak', () => {
    expect(sanitizePayloadStrict({ ...base, hybridPhaseByQuest: { [Q8]: 3 } })).toBeNull();
    expect(sanitizePayloadStrict({ ...base, hybridPhaseByQuest: 'rusak' })).toBeNull();
  });
});

describe('sanitizePersistedProgress — field fase dari data bermusuhan', () => {
  it('bentuk bermusuhan meluruh per-entri, tidak pernah melempar', () => {
    expect(
      sanitizePersistedProgress({ hybridPhaseByQuest: 'abc' }).hybridPhaseByQuest,
    ).toEqual({});
    expect(
      sanitizePersistedProgress({
        hybridPhaseByQuest: { [Q8]: 2, q1: 1, q2: '2' },
      }).hybridPhaseByQuest,
    ).toEqual({ [Q8]: 2 });
    expect(sanitizePersistedProgress(null).hybridPhaseByQuest).toEqual({});
  });
});

describe('envelope save — round-trip fase HYBRID', () => {
  it('buildEnvelope → validateEnvelope mempertahankan peta fase', () => {
    const payload: PersistedProgress = {
      completedQuests: [],
      codeByQuest: { [Q8]: "UPDATE omni_sync_logs SET status = 'SYNCED'" },
      focus: 80,
      hybridPhaseByQuest: { [Q8]: 2 },
    };
    const back = validateEnvelope(buildEnvelope(payload));
    expect(back).not.toBeNull();
    expect(back!.payload.hybridPhaseByQuest).toEqual({ [Q8]: 2 });
  });

  it('payload warisan tanpa field tetap lolos envelope', () => {
    const legacy = { completedQuests: ['q1'], codeByQuest: {}, focus: 90 };
    const back = validateEnvelope(buildEnvelope(legacy));
    expect(back!.payload.hybridPhaseByQuest).toEqual({});
  });
});

describe('gameStore — catatan fase HYBRID', () => {
  it('setHybridPhase(2) mencatat; setHybridPhase(1) menghapus', () => {
    const s = useGameStore.getState();
    s.setHybridPhase(Q8, 2);
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({ [Q8]: 2 });
    expect(selectPersistedProgress(useGameStore.getState()).hybridPhaseByQuest).toEqual({
      [Q8]: 2,
    });
    s.setHybridPhase(Q8, 1);
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({});
  });

  it('menyelesaikan quest membersihkan catatan fasenya', () => {
    const s = useGameStore.getState();
    s.setHybridPhase(Q8, 2);
    expect(s.completeQuest(Q8)).toBe(true);
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({});
    // Penyelesaian kedua tidak menghidupkan apa pun kembali.
    expect(s.completeQuest(Q8)).toBe(false);
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({});
  });

  it('hydrate memulihkan peta fase; bentuk bermusuhan tersanitasi', () => {
    const s = useGameStore.getState();
    s.hydrate({
      completedQuests: [],
      codeByQuest: {},
      focus: 50,
      hybridPhaseByQuest: { [Q8]: 2 },
    });
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({ [Q8]: 2 });
    s.hydrate({
      completedQuests: [],
      codeByQuest: {},
      focus: 50,
      hybridPhaseByQuest: { [Q8]: 'dua' } as unknown as Record<string, 2>,
    });
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({});
  });

  it('resetProgress membersihkan peta fase', () => {
    const s = useGameStore.getState();
    s.setHybridPhase(Q8, 2);
    s.resetProgress();
    expect(useGameStore.getState().hybridPhaseByQuest).toEqual({});
  });
});

describe('savedHybridPhase + planHybridReopen (keputusan murni)', () => {
  it('savedHybridPhase: hanya catatan 2 yang dibaca sebagai fase 2', () => {
    expect(savedHybridPhase({}, Q8)).toBe(1);
    expect(savedHybridPhase({ hybridPhaseByQuest: { [Q8]: 2 } }, Q8)).toBe(2);
    expect(savedHybridPhase({ hybridPhaseByQuest: { [Q8]: 2 } }, 'quest_lain')).toBe(1);
  });

  it('matriks rencana buka kembali', () => {
    const code = "UPDATE omni_sync_logs SET status = 'SYNCED' WHERE status = 'CORRUPT';";
    // Bukan HYBRID / belum pernah mencapai fase 2 → fase 1 biasa.
    expect(
      planHybridReopen({ isHybrid: false, savedPhase: 2, phase1Code: code, alreadyCompleted: false }),
    ).toEqual({ kind: 'phase1' });
    expect(
      planHybridReopen({ isHybrid: true, savedPhase: 1, phase1Code: code, alreadyCompleted: false }),
    ).toEqual({ kind: 'phase1' });
    // Quest sudah tuntas: catatan fase seharusnya sudah dibersihkan saat
    // penyelesaian — bila save janggal masih membawanya, tetap fase 1.
    expect(
      planHybridReopen({ isHybrid: true, savedPhase: 2, phase1Code: code, alreadyCompleted: true }),
    ).toEqual({ kind: 'phase1' });
    // Catatan fase 2 tanpa kode fase 1: basi, harus dibersihkan.
    expect(
      planHybridReopen({ isHybrid: true, savedPhase: 2, phase1Code: undefined, alreadyCompleted: false }),
    ).toEqual({ kind: 'clear-stale' });
    expect(
      planHybridReopen({ isHybrid: true, savedPhase: 2, phase1Code: '', alreadyCompleted: false }),
    ).toEqual({ kind: 'clear-stale' });
    // Kasus PT2-F6 yang sesungguhnya: replay kode fase 1 yang tersimpan.
    expect(
      planHybridReopen({ isHybrid: true, savedPhase: 2, phase1Code: code, alreadyCompleted: false }),
    ).toEqual({ kind: 'replay', phase1Code: code });
  });

  it('resolveHybridReplay: lulus → fase 2; gagal → fase 1 + hapus catatan', () => {
    expect(resolveHybridReplay({ pass: true })).toEqual({ phase: 2, clearSavedPhase: false });
    expect(resolveHybridReplay({ pass: false })).toEqual({ phase: 1, clearSavedPhase: true });
  });
});
