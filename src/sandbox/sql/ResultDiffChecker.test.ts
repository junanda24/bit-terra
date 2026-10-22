import { describe, expect, it } from 'vitest';
import { ResultDiffChecker } from './ResultDiffChecker';
import type { SqlRunResult } from '../../shared/types';

const LOST_SHEEP: SqlRunResult = {
  columns: ['sheep_name', 'last_zone'],
  rows: [
    { sheep_name: 'Srintil', last_zone: 'sungai' },
    { sheep_name: 'Mbah Woof', last_zone: 'hutan' },
  ],
};

const EXPECTED_LOST = [
  { sheep_name: 'Srintil', last_zone: 'sungai' },
  { sheep_name: 'Mbah Woof', last_zone: 'hutan' },
];

describe('ResultDiffChecker', () => {
  it('lulus untuk hasil yang persis sama', () => {
    const res = ResultDiffChecker.check(LOST_SHEEP, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(true);
    expect(res.diffs).toEqual([]);
  });

  it('lulus walau urutan baris berbeda saat orderMatters = false', () => {
    const shuffled: SqlRunResult = {
      columns: ['sheep_name', 'last_zone'],
      rows: [...LOST_SHEEP.rows].reverse(),
    };
    const res = ResultDiffChecker.check(shuffled, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(true);
  });

  it('lulus walau urutan dan nama kolom beda kapital', () => {
    const reordered: SqlRunResult = {
      columns: ['LAST_ZONE', 'SHEEP_NAME'],
      rows: [
        { LAST_ZONE: 'sungai', SHEEP_NAME: 'Srintil' },
        { LAST_ZONE: 'hutan', SHEEP_NAME: 'Mbah Woof' },
      ],
    };
    const res = ResultDiffChecker.check(reordered, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(true);
  });

  it('toleran variasi tipe angka vs string', () => {
    const actual: SqlRunResult = {
      columns: ['id', 'amount'],
      rows: [
        { id: '1', amount: '5000' },
        { id: '2', amount: '7500' },
      ],
    };
    const expected = [
      { id: 1, amount: 5000 },
      { id: 2, amount: 7500 },
    ];
    const res = ResultDiffChecker.check(actual, expected, {
      orderMatters: false,
    });
    expect(res.pass).toBe(true);
  });

  it('gagal bila ada baris yang hilang', () => {
    const partial: SqlRunResult = {
      columns: ['sheep_name', 'last_zone'],
      rows: [{ sheep_name: 'Srintil', last_zone: 'sungai' }],
    };
    const res = ResultDiffChecker.check(partial, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(false);
    expect(res.diffs.some((d) => d.includes('baris hilang'))).toBe(true);
    expect(res.diffs.join(' ')).toContain('Mbah Woof');
  });

  it('gagal bila ada baris ekstra', () => {
    const extra: SqlRunResult = {
      columns: ['sheep_name', 'last_zone'],
      rows: [
        ...LOST_SHEEP.rows,
        { sheep_name: 'Boni', last_zone: 'kandang' },
      ],
    };
    const res = ResultDiffChecker.check(extra, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(false);
    expect(res.diffs.some((d) => d.includes('baris ekstra'))).toBe(true);
  });

  it('gagal bila ada kolom ekstra', () => {
    const extraCol: SqlRunResult = {
      columns: ['sheep_name', 'last_zone', 'status'],
      rows: [
        { sheep_name: 'Srintil', last_zone: 'sungai', status: 'LOST' },
        { sheep_name: 'Mbah Woof', last_zone: 'hutan', status: 'LOST' },
      ],
    };
    const res = ResultDiffChecker.check(extraCol, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(false);
    expect(res.diffs).toContain('kolom ekstra: status');
  });

  it('gagal bila ada kolom yang hilang', () => {
    const missingCol: SqlRunResult = {
      columns: ['sheep_name'],
      rows: [{ sheep_name: 'Srintil' }, { sheep_name: 'Mbah Woof' }],
    };
    const res = ResultDiffChecker.check(missingCol, EXPECTED_LOST, {
      orderMatters: false,
    });
    expect(res.pass).toBe(false);
    expect(res.diffs).toContain('kolom hilang: last_zone');
  });

  it('orderMatters = true: urutan terbalik gagal, urutan benar lulus (quest ORDER BY)', () => {
    const reversed: SqlRunResult = {
      columns: ['sheep_name', 'last_zone'],
      rows: [...LOST_SHEEP.rows].reverse(),
    };
    const fail = ResultDiffChecker.check(reversed, EXPECTED_LOST, {
      orderMatters: true,
    });
    expect(fail.pass).toBe(false);
    expect(fail.diffs.some((d) => d.includes('urutan'))).toBe(true);

    const ok = ResultDiffChecker.check(LOST_SHEEP, EXPECTED_LOST, {
      orderMatters: true,
    });
    expect(ok.pass).toBe(true);
  });

  it('expected kosong: lulus hanya bila hasil aktual juga kosong', () => {
    const empty: SqlRunResult = { columns: ['sheep_name'], rows: [] };
    expect(
      ResultDiffChecker.check(empty, [], { orderMatters: false }).pass,
    ).toBe(true);
    const res = ResultDiffChecker.check(LOST_SHEEP, [], {
      orderMatters: false,
    });
    expect(res.pass).toBe(false);
    expect(res.diffs.some((d) => d.includes('baris ekstra'))).toBe(true);
  });
});
