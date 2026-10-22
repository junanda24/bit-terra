import { describe, expect, it } from 'vitest';
import { SqliteWasmRunner } from './SqliteWasmRunner';

const SEED = `
CREATE TABLE livestock_logs (
  id INTEGER PRIMARY KEY,
  sheep_name TEXT,
  last_zone TEXT,
  status TEXT
);
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES
  (1, 'Boni', 'kandang', 'OK'),
  (2, 'Srintil', 'sungai', 'LOST'),
  (3, 'Mbah Woof', 'hutan', 'LOST'),
  (4, 'Cempe', 'kandang', 'OK');
`;

describe('SqliteWasmRunner', () => {
  it('seed + SELECT round-trip di tabel livestock_logs', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(SEED);
    const result = runner.runQuery(
      'SELECT sheep_name, last_zone, status FROM livestock_logs ORDER BY id',
    );
    expect(result.columns).toEqual(['sheep_name', 'last_zone', 'status']);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0]).toEqual({
      sheep_name: 'Boni',
      last_zone: 'kandang',
      status: 'OK',
    });
    runner.dispose();
  });

  it('WHERE memfilter baris dengan benar (quest Q2: domba hilang)', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(SEED);
    const result = runner.runQuery(
      "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST'",
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.sheep_name)).toEqual(
      expect.arrayContaining(['Srintil', 'Mbah Woof']),
    );
    runner.dispose();
  });

  it('getSchema melaporkan tabel dan kolom hasil seed', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(SEED);
    const schema = runner.getSchema();
    expect(schema).toEqual([
      {
        table: 'livestock_logs',
        columns: ['id', 'sheep_name', 'last_zone', 'status'],
      },
    ]);
    runner.dispose();
  });

  it('error SQL dilempar dengan pesan mentah SQLite', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(SEED);
    expect(() => runner.runQuery('SELECT * FROM tabel_hantu')).toThrow(
      /no such table: tabel_hantu/,
    );
    expect(() => runner.runQuery('SELECT kolom_hantu FROM livestock_logs')).toThrow(
      /no such column/,
    );
    runner.dispose();
  });

  it('init ulang membuat database baru yang bersih', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(SEED);
    runner.runQuery(
      "INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (5, 'Baru', 'desa', 'OK')",
    );
    expect(runner.runQuery('SELECT id FROM livestock_logs').rows).toHaveLength(5);
    await runner.init(SEED);
    expect(runner.runQuery('SELECT id FROM livestock_logs').rows).toHaveLength(4);
    runner.dispose();
  });

  it('statement tanpa result set (UPDATE) memberi hasil kosong, lalu SELECT melihat efeknya', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(SEED);
    const upd = runner.runQuery(
      "UPDATE livestock_logs SET status = 'FOUND' WHERE status = 'LOST'",
    );
    expect(upd).toEqual({ columns: [], rows: [] });
    const after = runner.runQuery(
      "SELECT sheep_name FROM livestock_logs WHERE status = 'FOUND'",
    );
    expect(after.rows).toHaveLength(2);
    runner.dispose();
  });

  it('runQuery sebelum init melempar error yang jelas', () => {
    const runner = new SqliteWasmRunner();
    expect(() => runner.runQuery('SELECT 1')).toThrow(/init/);
  });
});
