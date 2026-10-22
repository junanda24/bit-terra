// ResultDiffChecker — menilai jawaban SQL pemain dari RESULT SET-nya,
// bukan dari teks query (docs/BLUEPRINT.md §5). Dua query yang berbeda
// teks tapi menghasilkan baris yang sama sama-sama lulus: alias kolom,
// urutan kolom, dan JOIN eksplisit vs implisit tidak dihukum.
//
// Perbandingan toleran tipe (1 == "1" lulus, null == undefined) dan peka
// huruf hanya pada NAMA kolom secara case-insensitive. Urutan baris
// diabaikan kecuali opts.orderMatters (quest ORDER BY).

import type { DiffResult, SqlRunResult } from '../../shared/types';

export interface DiffOptions {
  orderMatters: boolean;
}

/** Normalisasi nilai agar perbandingan toleran tipe ala SQLite. */
function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return value;
  }
  return value;
}

/** Ambil nilai sel dari baris berdasarkan nama kolom (case-insensitive). */
function cellOf(row: Record<string, unknown>, columnLower: string): unknown {
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === columnLower) return row[key];
  }
  return undefined;
}

/** Bentuk kanonik baris: { kolomLower: nilai ternormalisasi }. */
function canonicalRow(
  row: Record<string, unknown>,
  columnsLower: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columnsLower) out[col] = normalizeValue(cellOf(row, col));
  return out;
}

function rowKey(canonical: Record<string, unknown>): string {
  const entries = Object.entries(canonical).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return JSON.stringify(entries);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  return String(value);
}

/** Tampilan baris yang ramah dibaca pemain: {sheep_name: Srintil, status: LOST} */
function formatRow(canonical: Record<string, unknown>): string {
  const parts = Object.entries(canonical).map(
    ([col, v]) => `${col}: ${formatValue(v)}`,
  );
  return `{${parts.join(', ')}}`;
}

export class ResultDiffChecker {
  static check(
    actual: SqlRunResult,
    expected: Record<string, unknown>[],
    opts: DiffOptions,
  ): DiffResult {
    const diffs: string[] = [];

    const actualColsLower = actual.columns.map((c) => c.toLowerCase());
    const expectedColsLower = [
      ...new Set(expected.flatMap((row) => Object.keys(row).map((k) => k.toLowerCase()))),
    ];

    // Kasus khusus: jawaban yang diharapkan kosong — kolom tak bisa
    // disimpulkan, jadi cukup cocokkan jumlah baris.
    if (expected.length === 0) {
      for (const row of actual.rows) {
        diffs.push(
          `baris ekstra: ${formatRow(canonicalRow(row, actualColsLower))}`,
        );
      }
      return { pass: diffs.length === 0, diffs };
    }

    // 1. Himpunan nama kolom harus sama (case-insensitive).
    const actualColSet = new Set(actualColsLower);
    const expectedColSet = new Set(expectedColsLower);
    for (const col of actualColsLower) {
      if (!expectedColSet.has(col)) diffs.push(`kolom ekstra: ${col}`);
    }
    for (const col of expectedColsLower) {
      if (!actualColSet.has(col)) diffs.push(`kolom hilang: ${col}`);
    }
    if (diffs.length > 0) return { pass: false, diffs };

    const expectedCanon = expected.map((row) => canonicalRow(row, expectedColsLower));
    const actualCanon = actual.rows.map((row) => canonicalRow(row, expectedColsLower));

    // 2a. Urutan penting (quest ORDER BY): bandingkan per posisi.
    if (opts.orderMatters) {
      const max = Math.max(expectedCanon.length, actualCanon.length);
      for (let i = 0; i < max; i++) {
        const exp = expectedCanon[i];
        const act = actualCanon[i];
        if (exp && !act) {
          diffs.push(`baris hilang: ${formatRow(exp)}`);
        } else if (!exp && act) {
          diffs.push(`baris ekstra: ${formatRow(act)}`);
        } else if (exp && act && rowKey(exp) !== rowKey(act)) {
          diffs.push(
            `urutan baris ke-${i + 1} salah: diharapkan ${formatRow(exp)}, ditemukan ${formatRow(act)}`,
          );
        }
      }
      return { pass: diffs.length === 0, diffs };
    }

    // 2b. Urutan bebas: bandingkan sebagai multiset.
    const tally = (rows: Record<string, unknown>[]) => {
      const map = new Map<string, { row: Record<string, unknown>; count: number }>();
      for (const row of rows) {
        const key = rowKey(row);
        const entry = map.get(key);
        if (entry) entry.count++;
        else map.set(key, { row, count: 1 });
      }
      return map;
    };
    const expTally = tally(expectedCanon);
    const actTally = tally(actualCanon);

    for (const [key, exp] of expTally) {
      const actCount = actTally.get(key)?.count ?? 0;
      if (actCount < exp.count) {
        const missing = exp.count - actCount;
        diffs.push(
          `baris hilang: ${formatRow(exp.row)}${missing > 1 ? ` (kurang ${missing} baris)` : ''}`,
        );
      }
    }
    for (const [key, act] of actTally) {
      const expCount = expTally.get(key)?.count ?? 0;
      if (act.count > expCount) {
        const extra = act.count - expCount;
        diffs.push(
          `baris ekstra: ${formatRow(act.row)}${extra > 1 ? ` (lebih ${extra} baris)` : ''}`,
        );
      }
    }

    return { pass: diffs.length === 0, diffs };
  }
}
