// AUDIT PROBES — SQL sandbox (deep audit, read-only findings evidence).
// Each test encodes OBSERVED behavior of the CURRENT code. Tests asserting
// "bad" behavior are findings evidence; tests asserting correct behavior
// mark CLEAN areas. Do not "fix" these to match wishes — they document truth.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SqliteWasmRunner } from '../sandbox/sql/SqliteWasmRunner';
import { lint } from '../sandbox/sql/SqlAstLinter';
import { ResultDiffChecker } from '../sandbox/sql/ResultDiffChecker';
import { quest02DombaTersesat } from '../content/quests/quest_02_domba_tersesat';
import type { TableSchema } from '../shared/types';

const SEED = quest02DombaTersesat.sqlSeedScript!;
const EXPECTED = quest02DombaTersesat.expectedSqlResult!;
const SOLUTION =
  "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST'";

let schema: TableSchema[] = [];
let schemaRunner: SqliteWasmRunner;

beforeAll(async () => {
  schemaRunner = new SqliteWasmRunner();
  await schemaRunner.init(SEED);
  schema = schemaRunner.getSchema();
});

afterAll(() => schemaRunner.dispose());

async function freshRunner(): Promise<SqliteWasmRunner> {
  const r = new SqliteWasmRunner();
  await r.init(SEED);
  return r;
}

/* ============ AREA 1: destructive / multi-statement reachability ============ */

describe('A1 multi-statement SELECT;DROP', () => {
  it('A1a returns the SELECT result, then the table is gone for the next run', async () => {
    const r = await freshRunner();
    try {
      const res = r.runQuery(`${SOLUTION}; DROP TABLE livestock_logs;`);
      expect(res.rows).toHaveLength(3);
      expect(r.getSchema()).toEqual([]);
      expect(() => r.runQuery(SOLUTION)).toThrow(/no such table/i);
    } finally {
      r.dispose();
    }
  });

  it('A1b verdict PASSES on the destructive multi-statement input', async () => {
    const r = await freshRunner();
    try {
      const res = r.runQuery(`${SOLUTION}; DROP TABLE livestock_logs;`);
      const diff = ResultDiffChecker.check(res, EXPECTED, { orderMatters: false });
      expect(diff.pass).toBe(true);
    } finally {
      r.dispose();
    }
  });
});

describe('A2-A5 single destructive / passthrough statements mutate the session DB', () => {
  it('A2 UPDATE without WHERE rewrites all rows; solution then finds 0 rows', async () => {
    const r = await freshRunner();
    try {
      const out = r.runQuery("UPDATE livestock_logs SET status = 'HOME'");
      expect(out).toEqual({ columns: [], rows: [] });
      const after = r.runQuery(SOLUTION);
      expect(after.rows).toHaveLength(0);
      const diff = ResultDiffChecker.check(after, EXPECTED, { orderMatters: false });
      expect(diff.pass).toBe(false);
    } finally {
      r.dispose();
    }
  });

  it('A3 INSERT of a fake LOST sheep makes the correct query return 4 rows', async () => {
    const r = await freshRunner();
    try {
      r.runQuery(
        "INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (13, 'Palsu', 'Kandang', 'LOST')",
      );
      const after = r.runQuery(SOLUTION);
      expect(after.rows).toHaveLength(4);
      expect(
        ResultDiffChecker.check(after, EXPECTED, { orderMatters: false }).pass,
      ).toBe(false);
    } finally {
      r.dispose();
    }
  });

  it('A4 DELETE FROM empties the table for the rest of the session', async () => {
    const r = await freshRunner();
    try {
      r.runQuery('DELETE FROM livestock_logs');
      expect(r.runQuery(SOLUTION).rows).toHaveLength(0);
    } finally {
      r.dispose();
    }
  });

  it('A5 PRAGMA passes through runQuery as a normal result set', async () => {
    const r = await freshRunner();
    try {
      const res = r.runQuery('PRAGMA table_info(livestock_logs)');
      expect(res.rows.length).toBe(4);
      expect(res.columns).toContain('name');
    } finally {
      r.dispose();
    }
  });
});

/* ============ AREA 2: linter gate corpus (vs the real Q2 schema) ============ */

describe('B linter verdicts on statements the runner would execute', () => {
  it('B1 lint(UPDATE ... SET status) returns no errors', () => {
    expect(lint("UPDATE livestock_logs SET status = 'HOME'", schema)).toEqual([]);
  });
  it('B2 lint(DELETE FROM) returns no errors', () => {
    expect(lint('DELETE FROM livestock_logs', schema)).toEqual([]);
  });
  it('B3 lint(INSERT INTO ... VALUES) returns no errors', () => {
    expect(
      lint(
        "INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (13, 'Palsu', 'Kandang', 'LOST')",
        schema,
      ),
    ).toEqual([]);
  });
  it('B4 lint(DROP TABLE) returns no errors', () => {
    expect(lint('DROP TABLE livestock_logs', schema)).toEqual([]);
  });
  it('B5 lint(solution; DROP TABLE) — records what the gate would say', () => {
    const errs = lint(`${SOLUTION}; DROP TABLE livestock_logs;`, schema);
    // Observed behavior is asserted in the audit report; encode it here:
    expect(errs).toEqual([]);
  });
  it('B6 lint(PRAGMA ...) — records what the gate would say', () => {
    const errs = lint('PRAGMA table_info(livestock_logs)', schema);
    expect(errs.length).toBe(1);
    expect(errs[0].message).toMatch(/belum pas/);
  });
});

describe('C linter vs valid SQLite (false-positive hunt)', () => {
  it('C1 subquery in FROM with alias', () => {
    expect(
      lint(
        "SELECT t.sheep_name, t.last_zone FROM (SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST') t",
        schema,
      ),
    ).toEqual([]);
  });

  it('C2 self-JOIN with qualified aliases', () => {
    expect(
      lint(
        "SELECT a.sheep_name, a.last_zone FROM livestock_logs a JOIN livestock_logs b ON a.id = b.id WHERE a.status = 'LOST'",
        schema,
      ),
    ).toEqual([]);
  });

  it('C3 column alias reused in ORDER BY', () => {
    const errs = lint(
      "SELECT sheep_name AS nama, last_zone FROM livestock_logs WHERE status = 'LOST' ORDER BY nama",
      schema,
    );
    expect(errs.length).toBe(1);
    expect(errs[0].message).toMatch(/"nama" tidak ditemukan/);
  });

  it('C4 double-quoted identifiers', () => {
    expect(
      lint(
        'SELECT "sheep_name", "last_zone" FROM "livestock_logs" WHERE "status" = \'LOST\'',
        schema,
      ),
    ).toEqual([]);
  });

  it('C5 backtick-quoted identifiers', () => {
    expect(
      lint(
        "SELECT `sheep_name`, `last_zone` FROM `livestock_logs` WHERE `status` = 'LOST'",
        schema,
      ),
    ).toEqual([]);
  });

  it('C6 bracket-quoted identifiers (valid SQLite)', () => {
    const errs = lint(
      "SELECT [sheep_name], [last_zone] FROM [livestock_logs] WHERE [status] = 'LOST'",
      schema,
    );
    expect(errs.length).toBeGreaterThan(0);
  });

  it('C7 case-mangled keywords', () => {
    expect(
      lint(
        "SeLeCt sheep_name, last_zone FrOm livestock_logs WhErE status = 'LOST'",
        schema,
      ),
    ).toEqual([]);
  });

  it('C8 comments around and inside the query', () => {
    expect(
      lint(
        "-- cari domba hilang\nSELECT sheep_name, /* dua kolom saja */ last_zone FROM livestock_logs WHERE status = 'LOST' -- selesai",
        schema,
      ),
    ).toEqual([]);
  });

  it('C9 UNION of two valid selects', () => {
    expect(
      lint(
        "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST' UNION SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'SAFE'",
        schema,
      ),
    ).toEqual([]);
  });

  it('C10 CTE (WITH ... AS) referencing its own CTE name', () => {
    const errs = lint(
      "WITH lost AS (SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST') SELECT * FROM lost",
      schema,
    );
    expect(errs.length).toBe(1);
    expect(errs[0].message).toMatch(/Tabel "lost" tidak ditemukan/);
  });

  it('C11 ORDER BY ... COLLATE NOCASE: parser and SQLite agree (clean)', async () => {
    const sql = `${SOLUTION} ORDER BY sheep_name COLLATE NOCASE`;
    const r = await freshRunner();
    try {
      expect(r.runQuery(sql).rows).toHaveLength(3);
    } finally {
      r.dispose();
    }
    // Observed: node-sql-parser handles COLLATE; no lint error. NOT a
    // false positive (an earlier audit suspicion, disproven by this probe).
    expect(lint(sql, schema)).toEqual([]);
  });

  it('C12 CASE WHEN in SELECT: SQLite runs it, linter verdict recorded', async () => {
    const sql =
      "SELECT CASE WHEN status = 'LOST' THEN sheep_name ELSE 'aman' END AS nama, last_zone FROM livestock_logs WHERE status = 'LOST'";
    const r = await freshRunner();
    try {
      expect(r.runQuery(sql).rows).toHaveLength(3);
    } finally {
      r.dispose();
    }
    expect(lint(sql, schema)).toEqual([]);
  });

  it('C13 double-quoted STRING literal: status = "LOST" (parser and SQLite agree)', async () => {
    const sql =
      'SELECT sheep_name, last_zone FROM livestock_logs WHERE status = "LOST"';
    // Observed: the parser (sqlite mode) treats "LOST" as a string literal,
    // so lint is silent; SQLite's double-quoted-string fallback also treats
    // it as 'LOST' (no column named LOST exists) and returns the 3 rows.
    // The pair agree — NOT a false positive (suspicion disproven by probe).
    expect(lint(sql, schema)).toEqual([]);
    const r = await freshRunner();
    try {
      expect(r.runQuery(sql).rows).toHaveLength(3);
    } finally {
      r.dispose();
    }
  });

  it('C14 escaped quotes inside a string literal stay valid', async () => {
    const sql =
      "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST' AND sheep_name <> 'Si ''Putih'''";
    expect(lint(sql, schema)).toEqual([]);
    const r = await freshRunner();
    try {
      expect(() => r.runQuery(sql)).not.toThrow();
    } finally {
      r.dispose();
    }
  });
});

describe('D linter false negatives (lint clean, SQLite throws at run)', () => {
  it('D1 unknown function nofunc(...)', async () => {
    const sql =
      "SELECT nofunc(sheep_name), last_zone FROM livestock_logs WHERE status = 'LOST'";
    expect(lint(sql, schema)).toEqual([]);
    const r = await freshRunner();
    try {
      expect(() => r.runQuery(sql)).toThrow(/no such function/i);
    } finally {
      r.dispose();
    }
  });

  it('D2 truncated query (ends at WHERE) is lint-silent but SQLite throws', async () => {
    const sql = 'SELECT sheep_name, last_zone FROM livestock_logs WHERE';
    expect(lint(sql, schema)).toEqual([]);
    const r = await freshRunner();
    try {
      expect(() => r.runQuery(sql)).toThrow();
    } finally {
      r.dispose();
    }
  });

  it('D3 ORDER BY 99 (ordinal out of range)', async () => {
    const sql = `${SOLUTION} ORDER BY 99`;
    expect(lint(sql, schema)).toEqual([]);
    const r = await freshRunner();
    try {
      expect(() => r.runQuery(sql)).toThrow(/out of range|does not reference/i);
    } finally {
      r.dispose();
    }
  });

  it('D4 aggregate misused in WHERE', async () => {
    const sql =
      "SELECT sheep_name, last_zone FROM livestock_logs WHERE COUNT(*) > 1 AND status = 'LOST'";
    expect(lint(sql, schema)).toEqual([]);
    const r = await freshRunner();
    try {
      expect(() => r.runQuery(sql)).toThrow(/misuse of aggregate/i);
    } finally {
      r.dispose();
    }
  });

  it("D5 LIMIT 'abc' is rejected by the PARSER, so the gate blocks it (not a false negative)", async () => {
    const sql = `${SOLUTION} LIMIT 'abc'`;
    // Observed: node-sql-parser itself refuses a string LIMIT, so lint
    // returns the generic syntax error and RUN never executes it.
    const errs = lint(sql, schema);
    expect(errs.length).toBe(1);
    expect(errs[0].message).toMatch(/belum pas/);
    // At the raw runner level SQLite would also refuse it:
    const r = await freshRunner();
    try {
      expect(() => r.runQuery(sql)).toThrow(/datatype mismatch/i);
    } finally {
      r.dispose();
    }
  });
});

/* ============ AREA 3: ResultDiffChecker edge corpus ============ */

describe('E ResultDiffChecker edges', () => {
  const res = (columns: string[], rows: Record<string, unknown>[]) => ({
    columns,
    rows,
  });

  it('E1 duplicate expected rows vs single actual row fails (multiset honest)', () => {
    const diff = ResultDiffChecker.check(res(['a'], [{ a: 1 }]), [{ a: 1 }, { a: 1 }], {
      orderMatters: false,
    });
    expect(diff.pass).toBe(false);
    // Observed wording: the "(kurang N baris)" suffix only appears when
    // more than one copy is missing; a single missing copy is a bare line.
    expect(diff.diffs).toEqual(['baris hilang: {a: 1}']);
    const diff2 = ResultDiffChecker.check(
      res(['a'], [{ a: 1 }]),
      [{ a: 1 }, { a: 1 }, { a: 1 }],
      { orderMatters: false },
    );
    expect(diff2.pass).toBe(false);
    expect(diff2.diffs.join(' ')).toMatch(/kurang 2 baris/);
  });

  it('E2 duplicate expected rows vs two identical actual rows passes', () => {
    expect(
      ResultDiffChecker.check(res(['a'], [{ a: 1 }, { a: 1 }]), [{ a: 1 }, { a: 1 }], {
        orderMatters: false,
      }).pass,
    ).toBe(true);
  });

  it('E3 NULL expected vs missing key in actual row passes', () => {
    const diff = ResultDiffChecker.check(
      res(['sheep_name', 'last_zone'], [{ sheep_name: 'X' }]),
      [{ sheep_name: 'X', last_zone: null }],
      { orderMatters: false },
    );
    expect(diff.pass).toBe(true);
  });

  it('E4 float representation: 0.1+0.2 actual vs 0.3 expected', () => {
    const diff = ResultDiffChecker.check(res(['v'], [{ v: 0.1 + 0.2 }]), [{ v: 0.3 }], {
      orderMatters: false,
    });
    expect(diff.pass).toBe(false);
  });

  it('E5 integer 3 vs float 3.0 passes', () => {
    expect(
      ResultDiffChecker.check(res(['v'], [{ v: 3 }]), [{ v: 3.0 }], {
        orderMatters: false,
      }).pass,
    ).toBe(true);
  });

  it('E6 numeric string "3" vs number 3 passes (tolerance by design)', () => {
    expect(
      ResultDiffChecker.check(res(['v'], [{ v: '3' }]), [{ v: 3 }], {
        orderMatters: false,
      }).pass,
    ).toBe(true);
  });

  it('E7 orderMatters with duplicated rows out of order fails at position 2', () => {
    const diff = ResultDiffChecker.check(
      res(['a'], [{ a: 'A' }, { a: 'B' }, { a: 'A' }]),
      [{ a: 'A' }, { a: 'A' }, { a: 'B' }],
      { orderMatters: true },
    );
    expect(diff.pass).toBe(false);
    expect(diff.diffs.join(' ')).toMatch(/urutan baris ke-2/);
  });

  it('E8 column-name case difference only passes', () => {
    expect(
      ResultDiffChecker.check(
        res(['SHEEP_NAME', 'LAST_ZONE'], [{ SHEEP_NAME: 'Kriting', LAST_ZONE: 'Tepi Sungai' }]),
        [{ sheep_name: 'Kriting', last_zone: 'Tepi Sungai' }],
        { orderMatters: false },
      ).pass,
    ).toBe(true);
  });

  it('E9 empty expected: rows present fails, zero rows passes', () => {
    expect(
      ResultDiffChecker.check(res(['a'], [{ a: 1 }]), [], { orderMatters: false }).pass,
    ).toBe(false);
    expect(
      ResultDiffChecker.check(res(['a'], []), [], { orderMatters: false }).pass,
    ).toBe(true);
  });

  it('E10 object key order in rows is irrelevant', () => {
    const actualRow: Record<string, unknown> = {};
    actualRow['last_zone'] = 'Tepi Sungai';
    actualRow['sheep_name'] = 'Kriting';
    expect(
      ResultDiffChecker.check(
        res(['sheep_name', 'last_zone'], [actualRow]),
        [{ sheep_name: 'Kriting', last_zone: 'Tepi Sungai' }],
        { orderMatters: false },
      ).pass,
    ).toBe(true);
  });

  it('E11 actual with a duplicated column name still compares sanely', () => {
    const diff = ResultDiffChecker.check(
      res(['sheep_name', 'sheep_name', 'last_zone'], [
        { sheep_name: 'Kriting', last_zone: 'Tepi Sungai' },
      ]),
      [{ sheep_name: 'Kriting', last_zone: 'Tepi Sungai' }],
      { orderMatters: false },
    );
    expect(diff.pass).toBe(true);
  });

  it('E12 numeric-looking TEXT is coerced: expected "007" vs actual 7 passes', () => {
    expect(
      ResultDiffChecker.check(res(['code'], [{ code: 7 }]), [{ code: '007' }], {
        orderMatters: false,
      }).pass,
    ).toBe(true);
  });
});

/* ============ AREA 4: runner lifecycle ============ */

describe('F runner lifecycle', () => {
  it('F1 runQuery before init throws the friendly not-ready error', () => {
    const r = new SqliteWasmRunner();
    expect(() => r.runQuery('SELECT 1')).toThrow(/belum siap/);
  });

  it('F2 runQuery after dispose throws', async () => {
    const r = await freshRunner();
    r.dispose();
    expect(() => r.runQuery('SELECT 1')).toThrow(/belum siap/);
  });

  it('F3 init() twice fully replaces the database', async () => {
    const r = await freshRunner();
    try {
      await r.init('CREATE TABLE other_table (x INTEGER);');
      expect(r.getSchema().map((t) => t.table)).toEqual(['other_table']);
      expect(() => r.runQuery(SOLUTION)).toThrow(/no such table/i);
    } finally {
      r.dispose();
    }
  });

  it('F4 two runners hold isolated databases', async () => {
    const r1 = await freshRunner();
    const r2 = new SqliteWasmRunner();
    await r2.init('CREATE TABLE zzz_only (a INTEGER); INSERT INTO zzz_only VALUES (42);');
    try {
      expect(r1.runQuery(SOLUTION).rows).toHaveLength(3);
      expect(r2.getSchema().map((t) => t.table)).toEqual(['zzz_only']);
      expect(r2.runQuery('SELECT a FROM zzz_only').rows).toEqual([{ a: 42 }]);
    } finally {
      r1.dispose();
      r2.dispose();
    }
  });

  it('F5 seed with a mid-script error: init rejects BUT the partial DB stays queryable', async () => {
    const r = new SqliteWasmRunner();
    await expect(
      r.init(
        'CREATE TABLE t1 (a INTEGER); INSERT INTO t1 VALUES (1); THIS IS NOT SQL; INSERT INTO t1 VALUES (2);',
      ),
    ).rejects.toThrow();
    // The runner is left holding the half-seeded database (no rollback/dispose).
    expect(r.runQuery('SELECT a FROM t1').rows).toEqual([{ a: 1 }]);
    r.dispose();
  });

  it('F6 lint against an EMPTY schema is silent for everything', () => {
    expect(lint(SOLUTION, [])).toEqual([]);
    expect(lint('SELECT nonsense FROM nowhere_table', [])).toEqual([]);
    expect(lint('complete garbage !!!', [])).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/belum pas/) }),
    ]);
  });
});

/* ============ AREA 5: scanner probe table choice ============ */

describe('G scanner source-table selection (getSchema order)', () => {
  it('G1 schema[0] is the alphabetically-first table, not the first created', async () => {
    const r = new SqliteWasmRunner();
    await r.init(
      'CREATE TABLE zzz_quest (a INTEGER); CREATE TABLE aaa_decoy (b INTEGER);',
    );
    try {
      const s = r.getSchema();
      expect(s.map((t) => t.table)).toEqual(['aaa_decoy', 'zzz_quest']);
      // CyberDeckScreen picks schemaRef.current[0] as the scanner source.
      expect(s[0].table).toBe('aaa_decoy');
    } finally {
      r.dispose();
    }
  });
});
