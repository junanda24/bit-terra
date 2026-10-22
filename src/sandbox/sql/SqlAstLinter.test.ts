import { describe, expect, it } from 'vitest';
import { lint } from './SqlAstLinter';
import type { TableSchema } from '../../shared/types';

const SCHEMA: TableSchema[] = [
  {
    table: 'livestock_logs',
    columns: ['id', 'sheep_name', 'last_zone', 'status'],
  },
  { table: 'villagers', columns: ['id', 'name', 'job'] },
  { table: 'donations', columns: ['id', 'villager_id', 'amount'] },
];

describe('SqlAstLinter', () => {
  it('diam untuk query yang valid', () => {
    expect(
      lint(
        "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST'",
        SCHEMA,
      ),
    ).toEqual([]);
    expect(
      lint(
        'SELECT v.name, d.amount FROM villagers v INNER JOIN donations d ON d.villager_id = v.id GROUP BY v.id HAVING COUNT(*) > 1',
        SCHEMA,
      ),
    ).toEqual([]);
  });

  it('diam untuk input kosong atau hanya spasi', () => {
    expect(lint('', SCHEMA)).toEqual([]);
    expect(lint('   \n  ', SCHEMA)).toEqual([]);
  });

  it('diam untuk input yang terpotong di tengah pengetikan', () => {
    expect(lint('SELECT sheep_name FROM', SCHEMA)).toEqual([]);
    expect(lint('SELECT sheep_name FROM livestock_logs WHERE', SCHEMA)).toEqual([]);
    expect(
      lint('SELECT sheep_name FROM livestock_logs ORDER BY', SCHEMA),
    ).toEqual([]);
  });

  it('menangkap kolom tidak dikenal dan menyarankan nama terdekat', () => {
    const errors = lint('SELECT nama_domba FROM livestock_logs', SCHEMA);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('nama_domba');
    expect(errors[0].message).toContain('livestock_logs');
    expect(errors[0].suggestion).toContain('sheep_name');
  });

  it('menangkap kolom tidak dikenal berkualifikasi alias tabel', () => {
    const errors = lint(
      'SELECT l.nama_domba FROM livestock_logs AS l',
      SCHEMA,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].suggestion).toContain('sheep_name');
  });

  it('menangkap tabel tidak dikenal dan menyarankan tabel terdekat', () => {
    const errors = lint('SELECT sheep_name FROM livestock_log', SCHEMA);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('livestock_log');
    expect(errors[0].suggestion).toContain('livestock_logs');
  });

  it('menangkap error sintaks dengan pesan ramah, bukan dump parser', () => {
    const errors = lint('SELEC sheep_name FORM livestock_logs', SCHEMA);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].message).not.toContain('Expected');
    expect(errors[0].message).not.toContain('found');
  });

  it('perkiraan baris mengikuti posisi token yang salah', () => {
    const errors = lint(
      'SELECT sheep_name,\n  nama_domba\nFROM livestock_logs',
      SCHEMA,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });
});
