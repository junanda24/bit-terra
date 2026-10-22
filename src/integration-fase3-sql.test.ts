// Integration proof Fase 3 (Tahap C1): konten quest SQL baru (Q4, Q6, Q8)
// dibuktikan dengan EKSEKUSI sungguhan — seed dijalankan di sql.js,
// query solusi dibandingkan dengan expected, dan jebakan-jebakannya
// dibuktikan GAGAL. Pola yang sama dengan integration.test.ts (Q2).
import { describe, expect, it } from 'vitest';
import { quest04UrutanPanen } from './content/quests/quest_04_urutan_panen';
import { quest06KasFestival } from './content/quests/quest_06_kas_festival';
import { quest08GreatCommit } from './content/quests/quest_08_great_commit';
import { SqliteWasmRunner } from './sandbox/sql/SqliteWasmRunner';
import { SqlAstLinter } from './sandbox/sql/SqlAstLinter';
import { ResultDiffChecker } from './sandbox/sql/ResultDiffChecker';
import { executeGuardedSql } from './sandbox/sql/SqlStatementGuard';
import { assessFinalTableState } from './ui/cyberdeck/hybridLogic';

const Q4_SOLUTION =
  "SELECT petani, tanaman, berat_kg FROM panen_logs WHERE musim = 'Kemarau' ORDER BY berat_kg DESC LIMIT 3";
const Q6_SOLUTION =
  "SELECT a.nama, k.jumlah FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id WHERE k.kategori = 'Sewa Stan' AND k.jumlah > 150000";
const Q8_SOLUTION_UPDATE =
  "UPDATE omni_sync_logs SET status = 'SYNCED' WHERE status = 'CORRUPT'";

async function freshRunner(seed: string): Promise<SqliteWasmRunner> {
  const runner = new SqliteWasmRunner();
  await runner.init(seed);
  return runner;
}

describe('Q4 Teras Sawah — ORDER BY + LIMIT, terverifikasi eksekusi', () => {
  it('seed + query solusi == expectedSqlResult, per posisi (orderMatters)', async () => {
    const runner = await freshRunner(quest04UrutanPanen.sqlSeedScript!);
    try {
      const solved = runner.runQuery(Q4_SOLUTION);
      expect(solved.rows).toEqual(quest04UrutanPanen.expectedSqlResult);
      const diff = ResultDiffChecker.check(solved, quest04UrutanPanen.expectedSqlResult!, {
        orderMatters: true,
      });
      expect(diff.diffs).toEqual([]);
      expect(diff.pass).toBe(true);
      // Expected memang tiga terberat Kemarau, menurun 96 > 91 > 84.
      expect(solved.rows.map((r) => r.berat_kg)).toEqual([96, 91, 84]);
    } finally {
      runner.dispose();
    }
  });

  it('jebakan gagal semua: tanpa ORDER BY, tanpa WHERE, dan ASC', async () => {
    const runner = await freshRunner(quest04UrutanPanen.sqlSeedScript!);
    try {
      const traps = [
        "SELECT petani, tanaman, berat_kg FROM panen_logs WHERE musim = 'Kemarau' LIMIT 3",
        'SELECT petani, tanaman, berat_kg FROM panen_logs ORDER BY berat_kg DESC LIMIT 3',
        "SELECT petani, tanaman, berat_kg FROM panen_logs WHERE musim = 'Kemarau' ORDER BY berat_kg ASC LIMIT 3",
      ];
      for (const sql of traps) {
        const res = runner.runQuery(sql);
        const diff = ResultDiffChecker.check(res, quest04UrutanPanen.expectedSqlResult!, {
          orderMatters: true,
        });
        expect(diff.pass, sql).toBe(false);
      }
    } finally {
      runner.dispose();
    }
  });

  it('linter bersih untuk query solusi; sqlOrderMatters + sqlSourceTable terpasang', async () => {
    const runner = await freshRunner(quest04UrutanPanen.sqlSeedScript!);
    try {
      expect(SqlAstLinter.lint(Q4_SOLUTION, runner.getSchema())).toEqual([]);
      expect(quest04UrutanPanen.sqlOrderMatters).toBe(true);
      expect(quest04UrutanPanen.sqlSourceTable).toBe('panen_logs');
    } finally {
      runner.dispose();
    }
  });
});

describe('Q6 Festival Panen Raya — JOIN dua tabel, terverifikasi eksekusi', () => {
  it('seed + query solusi (JOIN eksplisit) == expectedSqlResult', async () => {
    const runner = await freshRunner(quest06KasFestival.sqlSeedScript!);
    try {
      const solved = runner.runQuery(Q6_SOLUTION);
      const diff = ResultDiffChecker.check(solved, quest06KasFestival.expectedSqlResult!, {
        orderMatters: false,
      });
      expect(diff.diffs).toEqual([]);
      expect(diff.pass).toBe(true);
      expect(solved.rows).toHaveLength(3);
    } finally {
      runner.dispose();
    }
  });

  it('JOIN implisit (koma + WHERE) adalah jawaban sah yang sama', async () => {
    const runner = await freshRunner(quest06KasFestival.sqlSeedScript!);
    try {
      const implicit = runner.runQuery(
        "SELECT a.nama, k.jumlah FROM anggota_festival a, kas_festival k WHERE k.anggota_id = a.id AND k.kategori = 'Sewa Stan' AND k.jumlah > 150000",
      );
      const diff = ResultDiffChecker.check(implicit, quest06KasFestival.expectedSqlResult!, {
        orderMatters: false,
      });
      expect(diff.pass).toBe(true);
    } finally {
      runner.dispose();
    }
  });

  it('jebakan gagal: kategori bocor (Dekorasi 300rb ikut) dan batas >= (Rudi 150rb ikut)', async () => {
    const runner = await freshRunner(quest06KasFestival.sqlSeedScript!);
    try {
      const traps = [
        'SELECT a.nama, k.jumlah FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id WHERE k.jumlah > 150000',
        "SELECT a.nama, k.jumlah FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id WHERE k.kategori = 'Sewa Stan' AND k.jumlah >= 150000",
        "SELECT a.nama, k.jumlah FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id WHERE k.kategori = 'Sewa Stan'",
      ];
      for (const sql of traps) {
        const res = runner.runQuery(sql);
        const diff = ResultDiffChecker.check(res, quest06KasFestival.expectedSqlResult!, {
          orderMatters: false,
        });
        expect(diff.pass, sql).toBe(false);
      }
    } finally {
      runner.dispose();
    }
  });

  it('linter bersih untuk JOIN solusi; scanner sengaja BUKAN tabel pertama abjad', async () => {
    const runner = await freshRunner(quest06KasFestival.sqlSeedScript!);
    try {
      expect(SqlAstLinter.lint(Q6_SOLUTION, runner.getSchema())).toEqual([]);
      const schema = runner.getSchema();
      // Skema terurut abjad: anggota_festival lebih dulu. Pilihan quest
      // harus menang atas urutan itu (jebakan audit SQL-M2).
      expect(schema[0].table).toBe('anggota_festival');
      expect(quest06KasFestival.sqlSourceTable).toBe('kas_festival');
    } finally {
      runner.dispose();
    }
  });
});

describe('Q8 Magang di OmniCloud — fase 1 UPDATE, verdict keadaan akhir', () => {
  it('seed: tepat 4 CORRUPT (id 3,5,7,9) + status sehat beragam PENDING/OFFLINE', async () => {
    const runner = await freshRunner(quest08GreatCommit.sqlSeedScript!);
    try {
      const all = runner.runQuery('SELECT * FROM omni_sync_logs');
      expect(all.rows).toHaveLength(10);
      const corrupt = all.rows.filter((r) => r.status === 'CORRUPT');
      expect(corrupt.map((r) => r.id)).toEqual([3, 5, 7, 9]);
      expect(all.rows.find((r) => r.id === 2)?.status).toBe('PENDING');
      expect(all.rows.find((r) => r.id === 6)?.status).toBe('OFFLINE');
    } finally {
      runner.dispose();
    }
  });

  it('skrip solusi lengkap (SELECT selidik + UPDATE) -> keadaan akhir persis harapan', async () => {
    const runner = await freshRunner(quest08GreatCommit.sqlSeedScript!);
    try {
      const script = `SELECT id, perangkat, status FROM omni_sync_logs WHERE status = 'CORRUPT';\n${Q8_SOLUTION_UPDATE};`;
      const outcome = executeGuardedSql(runner, script, true);
      // Quest tulis yang sah: tidak terkontaminasi, tidak di-rollback.
      expect(outcome.contaminated).toBe(false);
      const finalRows = runner.runQuery('SELECT * FROM omni_sync_logs').rows;
      expect(assessFinalTableState(finalRows, quest08GreatCommit.expectedFinalTableState!))
        .toEqual({ pass: true, corruptRemaining: 0 });
    } finally {
      runner.dispose();
    }
  });

  it('jebakan gagal dengan kunci reaksi yang benar', async () => {
    const cases: [string, string][] = [
      // Tanpa WHERE: PENDING & OFFLINE ikut tertimpa SYNCED.
      ["UPDATE omni_sync_logs SET status = 'SYNCED'", 'innocent_changed'],
      // Perbaikan sebagian (satu zona saja): masih ada CORRUPT.
      ["UPDATE omni_sync_logs SET status = 'SYNCED' WHERE zona = 'Kebun'", 'still_corrupt'],
      // Menghapus baris rusak bukan memperbaikinya.
      ["DELETE FROM omni_sync_logs WHERE status = 'CORRUPT'", 'innocent_changed'],
      // Hanya menyelidiki, tidak memperbaiki apa pun.
      ["SELECT id, perangkat, status FROM omni_sync_logs WHERE status = 'CORRUPT'", 'still_corrupt'],
    ];
    for (const [sql, expectedKey] of cases) {
      const runner = await freshRunner(quest08GreatCommit.sqlSeedScript!);
      try {
        executeGuardedSql(runner, sql, true);
        const finalRows = runner.runQuery('SELECT * FROM omni_sync_logs').rows;
        const a = assessFinalTableState(
          finalRows,
          quest08GreatCommit.expectedFinalTableState!,
        );
        expect(a.pass, sql).toBe(false);
        if (!a.pass) expect(a.reactionKey, sql).toBe(expectedKey);
      } finally {
        runner.dispose();
      }
    }
  });

  it('di quest baca-saja UPDATE yang sama akan di-rollback (kontras sqlWritesAllowed)', async () => {
    const runner = await freshRunner(quest08GreatCommit.sqlSeedScript!);
    try {
      const outcome = executeGuardedSql(runner, Q8_SOLUTION_UPDATE, false);
      expect(outcome.contaminated).toBe(true);
      const rows = runner.runQuery(
        "SELECT COUNT(*) AS n FROM omni_sync_logs WHERE status = 'CORRUPT'",
      ).rows;
      expect(rows[0].n).toBe(4);
    } finally {
      runner.dispose();
    }
  });

  it('linter bersih untuk skrip solusi fase 1 (multi-statement SELECT + UPDATE)', async () => {
    const runner = await freshRunner(quest08GreatCommit.sqlSeedScript!);
    try {
      const script = `SELECT id, perangkat, status FROM omni_sync_logs WHERE status = 'CORRUPT';\n${Q8_SOLUTION_UPDATE};`;
      expect(SqlAstLinter.lint(script, runner.getSchema())).toEqual([]);
      expect(quest08GreatCommit.sqlWritesAllowed).toBe(true);
      expect(quest08GreatCommit.sqlSourceTable).toBe('omni_sync_logs');
    } finally {
      runner.dispose();
    }
  });
});
