import { describe, expect, it } from 'vitest';
import {
  assessFinalTableState,
  hybridPhaseCodeKey,
  hybridPhaseInitialCode,
} from './hybridLogic';
import { quest08GreatCommit } from '../../content/quests/quest_08_great_commit';

const EXPECTED = quest08GreatCommit.expectedFinalTableState!;

/** Keadaan seed Q8 (sebelum perbaikan): 4 baris CORRUPT. */
function seedState(): Record<string, unknown>[] {
  return EXPECTED.map((row) =>
    [3, 5, 7, 9].includes(Number(row.id)) ? { ...row, status: 'CORRUPT' } : { ...row },
  );
}

describe('assessFinalTableState', () => {
  it('keadaan persis seperti harapan: lulus', () => {
    const a = assessFinalTableState(structuredClone(EXPECTED), EXPECTED);
    expect(a).toEqual({ pass: true, corruptRemaining: 0 });
  });

  it('urutan baris tidak dihukum', () => {
    const shuffled = [...structuredClone(EXPECTED)].reverse();
    expect(assessFinalTableState(shuffled, EXPECTED).pass).toBe(true);
  });

  it('seed mentah (belum diperbaiki): still_corrupt dengan 4 sisa', () => {
    const a = assessFinalTableState(seedState(), EXPECTED);
    expect(a.pass).toBe(false);
    if (!a.pass) {
      expect(a.reactionKey).toBe('still_corrupt');
      expect(a.corruptRemaining).toBe(4);
    }
  });

  it('perbaikan sebagian: still_corrupt dengan sisa yang benar', () => {
    const partial = seedState().map((row) =>
      row.id === 3 ? { ...row, status: 'SYNCED' } : row,
    );
    const a = assessFinalTableState(partial, EXPECTED);
    expect(a.pass).toBe(false);
    if (!a.pass) {
      expect(a.reactionKey).toBe('still_corrupt');
      expect(a.corruptRemaining).toBe(3);
    }
  });

  it('UPDATE tanpa WHERE (PENDING/OFFLINE ikut tertimpa): innocent_changed', () => {
    const blanket = seedState().map((row) => ({ ...row, status: 'SYNCED' }));
    const a = assessFinalTableState(blanket, EXPECTED);
    expect(a.pass).toBe(false);
    if (!a.pass) expect(a.reactionKey).toBe('innocent_changed');
  });

  it('baris rusak dihapus, bukan diperbaiki: innocent_changed', () => {
    const deleted = seedState().filter((row) => row.status !== 'CORRUPT');
    const a = assessFinalTableState(deleted, EXPECTED);
    expect(a.pass).toBe(false);
    if (!a.pass) expect(a.reactionKey).toBe('innocent_changed');
  });

  it('satu baris sehat berganti nama perangkat: innocent_changed', () => {
    const renamed = structuredClone(EXPECTED).map((row) =>
      row.id === 4 ? { ...row, perangkat: 'Lampu Gudang' } : row,
    );
    const a = assessFinalTableState(renamed, EXPECTED);
    expect(a.pass).toBe(false);
    if (!a.pass) expect(a.reactionKey).toBe('innocent_changed');
  });
});

describe('mekanik dua fase', () => {
  it('kunci kode: fase 1 = id polos, fase 2 = sufiks :fase2', () => {
    expect(hybridPhaseCodeKey('quest_08_great_commit', 1)).toBe('quest_08_great_commit');
    expect(hybridPhaseCodeKey('quest_08_great_commit', 2)).toBe('quest_08_great_commit:fase2');
  });

  it('kode awal per fase datang dari data quest yang benar', () => {
    expect(hybridPhaseInitialCode(quest08GreatCommit, 1)).toBe(
      quest08GreatCommit.initialCode,
    );
    expect(hybridPhaseInitialCode(quest08GreatCommit, 2)).toBe(
      quest08GreatCommit.hybridBotInitialCode,
    );
    expect(hybridPhaseInitialCode(quest08GreatCommit, 2)).toContain('piko.');
  });
});
