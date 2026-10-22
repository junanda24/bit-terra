import { describe, expect, it } from 'vitest';
import { SqliteWasmRunner } from '../../sandbox/sql/SqliteWasmRunner';
import { executeGuardedSql } from '../../sandbox/sql/SqlStatementGuard';
import {
  assessFinalTableState,
  planHybridReopen,
  resolveHybridReplay,
  savedHybridPhase,
} from './hybridLogic';
import { quest08GreatCommit } from '../../content/quests/quest_08_great_commit';

/**
 * PT2-F6 di tingkat mesin: siklus hidup persis yang dialami pemain —
 * fase 1 lulus di "sesi" pertama, deck ditutup, lalu dibuka lagi di
 * "sesi" kedua dengan runner BARU yang di-seed dari nol. Kode fase 1
 * tersimpan diputar ulang secara diam-diam; keadaan akhir tabel harus
 * terbukti pulih sebelum layar berani masuk fase 2.
 */
const PHASE1_SCRIPT = `SELECT id, perangkat, status FROM omni_sync_logs WHERE status = 'CORRUPT';
UPDATE omni_sync_logs SET status = 'SYNCED' WHERE status = 'CORRUPT';`;

const EXPECTED = quest08GreatCommit.expectedFinalTableState!;
const TABLE = quest08GreatCommit.sqlSourceTable!;

async function freshRunner(): Promise<SqliteWasmRunner> {
  const runner = new SqliteWasmRunner();
  await runner.init(quest08GreatCommit.sqlSeedScript!);
  return runner;
}

function finalRows(runner: SqliteWasmRunner): Record<string, unknown>[] {
  return runner.runQuery(`SELECT * FROM "${TABLE}"`).rows;
}

describe('PT2-F6 — replay fase 1 di mesin baru', () => {
  it('keadaan yang dipulihkan terbukti lulus assessFinalTableState', async () => {
    // — Sesi pertama: pemain menuntaskan fase 1 dengan skrip ini. —
    const first = await freshRunner();
    try {
      const outcome = executeGuardedSql(
        first,
        PHASE1_SCRIPT,
        quest08GreatCommit.sqlWritesAllowed === true,
      );
      expect(outcome.contaminated).toBe(false);
      expect(assessFinalTableState(finalRows(first), EXPECTED)).toEqual({
        pass: true,
        corruptRemaining: 0,
      });
    } finally {
      first.dispose();
    }

    // — Keputusan buka kembali dari progres tersimpan (murni). —
    const plan = planHybridReopen({
      isHybrid: true,
      savedPhase: savedHybridPhase(
        { hybridPhaseByQuest: { [quest08GreatCommit.id]: 2 } },
        quest08GreatCommit.id,
      ),
      phase1Code: PHASE1_SCRIPT,
      alreadyCompleted: false,
    });
    expect(plan).toEqual({ kind: 'replay', phase1Code: PHASE1_SCRIPT });
    if (plan.kind !== 'replay') throw new Error('rencana harus replay');

    // — Sesi kedua: runner baru, seed mentah (4 CORRUPT)… —
    const second = await freshRunner();
    try {
      const before = assessFinalTableState(finalRows(second), EXPECTED);
      expect(before.pass).toBe(false);
      if (!before.pass) {
        expect(before.reactionKey).toBe('still_corrupt');
        expect(before.corruptRemaining).toBe(4);
      }
      // …replay diam-diam kode fase 1 yang sama…
      executeGuardedSql(second, plan.phase1Code, quest08GreatCommit.sqlWritesAllowed === true);
      // …dan keadaan akhir tabel pulih persis: layar boleh masuk fase 2.
      const assessment = assessFinalTableState(finalRows(second), EXPECTED);
      expect(assessment).toEqual({ pass: true, corruptRemaining: 0 });
      expect(resolveHybridReplay(assessment)).toEqual({
        phase: 2,
        clearSavedPhase: false,
      });
    } finally {
      second.dispose();
    }
  });

  it('replay kode yang TIDAK memperbaiki: keputusan jatuh ke fase 1 + hapus catatan', async () => {
    const runner = await freshRunner();
    try {
      // Kode fase 1 "tersimpan" yang hanya menyelidiki — tidak pernah
      // mencapai keadaan akhir yang diharapkan (pertahanan berlapis:
      // catatan fase tidak boleh memaksa fase 2 yang rusak).
      executeGuardedSql(
        runner,
        "SELECT id, perangkat, status FROM omni_sync_logs WHERE status = 'CORRUPT';",
        quest08GreatCommit.sqlWritesAllowed === true,
      );
      const assessment = assessFinalTableState(finalRows(runner), EXPECTED);
      expect(assessment.pass).toBe(false);
      expect(resolveHybridReplay(assessment)).toEqual({
        phase: 1,
        clearSavedPhase: true,
      });
    } finally {
      runner.dispose();
    }
  });
});
