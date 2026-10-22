// SqlRuntimeError — pemetaan pesan SQLite → kelas masalah + narasi (SQL-M1).
// Kelas menentukan kalimat Piko; pesan mentah tidak boleh bocor ke narasi.

import { describe, it, expect } from 'vitest';
import { classifySqlRuntimeError } from './SqlRuntimeError';
import { SqliteWasmRunner } from './SqliteWasmRunner';
import { quest02DombaTersesat } from '../../content/quests/quest_02_domba_tersesat';

describe('classifySqlRuntimeError — pemetaan pesan', () => {
  it('fungsi tak dikenal: kelasnya tepat dan nama fungsinya disebut', () => {
    const c = classifySqlRuntimeError(new Error('no such function: POWER'));
    expect(c.kind).toBe('unknown_function');
    expect(c.narration).toContain('POWER');
    expect(c.narration).toContain('COUNT');
  });

  it('agregat di WHERE: kelas misuse of aggregate', () => {
    const c = classifySqlRuntimeError(
      new Error('misuse of aggregate function COUNT()'),
    );
    expect(c.kind).toBe('aggregate_misuse');
    expect(c.narration).toContain('WHERE');
    expect(c.narration).toContain('HAVING');
  });

  it('ordinal ORDER BY di luar jangkauan: kelas out of range', () => {
    const c = classifySqlRuntimeError(
      new Error('1st ORDER BY term out of range - should be between 1 and 2'),
    );
    expect(c.kind).toBe('ordinal_out_of_range');
    expect(c.narration).toContain('ORDER BY');
  });

  it('datatype mismatch punya kelas sendiri', () => {
    expect(classifySqlRuntimeError(new Error('datatype mismatch')).kind).toBe(
      'datatype_mismatch',
    );
  });

  it('tabel/kolom tak dikenal disebut namanya', () => {
    const t = classifySqlRuntimeError(new Error('no such table: tabel_hantu'));
    expect(t.kind).toBe('no_such_table');
    expect(t.narration).toContain('tabel_hantu');
    const c = classifySqlRuntimeError(
      new Error('no such column: nama_domba'),
    );
    expect(c.kind).toBe('no_such_column');
    expect(c.narration).toContain('nama_domba');
  });

  it('input terpotong & syntax error & pesan asing', () => {
    expect(classifySqlRuntimeError(new Error('incomplete input')).kind).toBe(
      'incomplete_input',
    );
    expect(
      classifySqlRuntimeError(new Error('near "FORM": syntax error')).kind,
    ).toBe('syntax');
    const other = classifySqlRuntimeError(new Error('sesuatu yang asing'));
    expect(other.kind).toBe('other');
    expect(other.narration).not.toContain('asing');
  });
});

describe('classifySqlRuntimeError — dari error runner asli', () => {
  it('NOW() di quest 2 terklasifikasi unknown_function dan menyebut NOW', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(quest02DombaTersesat.sqlSeedScript ?? '');
    let caught: unknown;
    try {
      runner.runQuery('SELECT NOW() FROM livestock_logs');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const c = classifySqlRuntimeError(caught);
    expect(c.kind).toBe('unknown_function');
    expect(c.narration).toContain('NOW');
    runner.dispose();
  });
});
