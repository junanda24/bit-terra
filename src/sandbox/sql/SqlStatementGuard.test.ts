// SqlStatementGuard — uji pembungkus auto-rollback SQL-H1 memakai runner
// asli + seed asli quest 2, supaya buktinya end-to-end di lapisan sandbox:
// run terkontaminasi boleh TERLIHAT efeknya, tapi DB terbukti utuh lagi.

import { describe, it, expect, beforeAll } from 'vitest';
import { SqliteWasmRunner } from './SqliteWasmRunner';
import { classifySqlStatements, executeGuardedSql } from './SqlStatementGuard';
import { quest02DombaTersesat } from '../../content/quests/quest_02_domba_tersesat';

const SOLUTION =
  "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST'";

async function freshRunner(): Promise<SqliteWasmRunner> {
  const runner = new SqliteWasmRunner();
  await runner.init(quest02DombaTersesat.sqlSeedScript ?? '');
  return runner;
}

function lostCount(runner: SqliteWasmRunner): number {
  return runner.runQuery(
    "SELECT COUNT(*) AS c FROM livestock_logs WHERE status = 'LOST'",
  ).rows[0].c as number;
}

describe('classifySqlStatements', () => {
  it('SELECT murni bukan tulis', () => {
    const c = classifySqlStatements(SOLUTION);
    expect(c.hasWrites).toBe(false);
    expect(c.types).toEqual(['select']);
  });

  it('CTE yang membungkus SELECT tetap baca-saja', () => {
    const c = classifySqlStatements(
      "WITH l AS (SELECT * FROM livestock_logs) SELECT * FROM l",
    );
    expect(c.hasWrites).toBe(false);
  });

  it('setiap verb tulis terdeteksi', () => {
    for (const sql of [
      "UPDATE livestock_logs SET status = 'HOME'",
      "INSERT INTO livestock_logs VALUES (99, 'X', 'Y', 'LOST')",
      "DELETE FROM livestock_logs",
      'DROP TABLE livestock_logs',
      'CREATE TABLE curian (a INTEGER)',
      'CREATE INDEX idx ON livestock_logs (status)',
      'ALTER TABLE livestock_logs ADD COLUMN x TEXT',
    ]) {
      expect(classifySqlStatements(sql).hasWrites, sql).toBe(true);
    }
  });

  it('multi-statement: satu tulis di tengah SELECT terdeteksi', () => {
    const c = classifySqlStatements(`${SOLUTION}; DROP TABLE livestock_logs`);
    expect(c.hasWrites).toBe(true);
    expect(c.writeTypes).toEqual(['drop']);
  });

  it('input yang tidak bisa diparse = klasifikasi kosong (bukan tulis)', () => {
    expect(classifySqlStatements('PRAGMA table_info(livestock_logs)')).toEqual({
      types: [],
      hasWrites: false,
      writeTypes: [],
    });
    expect(classifySqlStatements('SELECT FROM WHERE').hasWrites).toBe(false);
    expect(classifySqlStatements('   ').hasWrites).toBe(false);
  });
});

describe('executeGuardedSql — quest baca-saja (writesAllowed=false)', () => {
  let runner: SqliteWasmRunner;
  beforeAll(async () => {
    runner = await freshRunner();
  });

  it('SELECT murni: tidak terkontaminasi, hasil utuh', () => {
    const outcome = executeGuardedSql(runner, SOLUTION, false);
    expect(outcome.contaminated).toBe(false);
    expect(outcome.result.rows).toHaveLength(3);
  });

  it('A1b dibunuh: solusi + DROP mengembalikan baris yang benar TAPI terkontaminasi dan tabel utuh lagi', () => {
    const outcome = executeGuardedSql(
      runner,
      `${SOLUTION}; DROP TABLE livestock_logs`,
      false,
    );
    // Hasilnya tetap terlihat pemain (diff bisa dihitung) ...
    expect(outcome.result.rows).toHaveLength(3);
    // ... tapi run-nya terkontaminasi → tidak boleh menyelesaikan quest ...
    expect(outcome.contaminated).toBe(true);
    // ... dan tabelnya terbukti masih ada dengan isi persis seperti semula.
    expect(lostCount(runner)).toBe(3);
    expect(runner.runQuery(SOLUTION).rows).toHaveLength(3);
  });

  it('UPDATE yang "memperbaiki" data: efek terlihat sesaat, lalu di-rollback', () => {
    const outcome = executeGuardedSql(
      runner,
      "UPDATE livestock_logs SET status = 'HOME'; SELECT COUNT(*) AS c FROM livestock_logs WHERE status = 'LOST'",
      false,
    );
    expect(outcome.contaminated).toBe(true);
    // Pemain melihat efek tulisannya di hasil run itu ...
    expect(outcome.result.rows[0].c).toBe(0);
    // ... tapi DB sudah kembali: 3 domba tetap LOST.
    expect(lostCount(runner)).toBe(3);
  });

  it('INSERT tidak bocor ke run berikutnya', () => {
    const outcome = executeGuardedSql(
      runner,
      "INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (99, 'Palsu', 'Entah', 'LOST')",
      false,
    );
    expect(outcome.contaminated).toBe(true);
    expect(lostCount(runner)).toBe(3);
    expect(runner.runQuery(SOLUTION).rows).toHaveLength(3);
  });

  it('error di tengah multi-statement ikut di-rollback sebelum error diteruskan', () => {
    expect(() =>
      executeGuardedSql(
        runner,
        "UPDATE livestock_logs SET status = 'HOME'; SELECT * FROM tabel_hantu",
        false,
      ),
    ).toThrow(/no such table/i);
    expect(lostCount(runner)).toBe(3);
  });
});

describe('executeGuardedSql — quest tulis-sah (writesAllowed=true, pola Fase 3 Q8)', () => {
  it('tulisan persisten dan tidak ditandai terkontaminasi', async () => {
    const runner = await freshRunner();
    const outcome = executeGuardedSql(
      runner,
      "UPDATE livestock_logs SET status = 'HOME' WHERE sheep_name = 'Kriting'",
      true,
    );
    expect(outcome.contaminated).toBe(false);
    expect(lostCount(runner)).toBe(2);
    runner.dispose();
  });
});
