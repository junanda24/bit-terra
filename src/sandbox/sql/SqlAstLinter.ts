// SqlAstLinter — linter SQL real-time berbasis AST (node-sql-parser).
//
// Tiga lapis pemeriksaan (docs/BLUEPRINT.md §3B):
// 1. Sintaks: query yang tidak bisa diparse → satu pesan ramah berbahasa
//    Indonesia + perkiraan baris/kolom. Dump mentah parser TIDAK PERNAH
//    diteruskan ke pemain.
// 2. Nama tabel terhadap skema aktif.
// 3. Nama kolom terhadap skema aktif, dengan saran "apakah maksudmu X?"
//    dari nama terdekat (skor gabungan: token, bigram, jarak edit).
//
// Input kosong / terpotong di tengah pengetikan (parser melaporkan
// "end of input") dianggap "masih mengetik" → tidak ada error, supaya
// linter tidak menyepam pemain di setiap ketukan.

import { Parser } from 'node-sql-parser';
import type { LintError, TableSchema } from '../../shared/types';

const parser = new Parser();

/* ---------------------------------- skor kemiripan nama ---------------------------------- */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let shared = 0;
  for (const g of ba) if (bb.has(g)) shared++;
  return (2 * shared) / (ba.size + bb.size);
}

function tokensOf(name: string): string[] {
  return name.split('_').filter((t) => t.length > 0);
}

/**
 * Skor kemiripan 0..~1. Levenshtein mentah menyesatkan untuk nama
 * snake_case (nama_domba lebih dekat ke last_zone daripada sheep_name),
 * jadi token yang mirip (nama ~ name) dan kemiripan bigram ikut dihitung.
 */
function similarity(target: string, candidate: string): number {
  const t = target.toLowerCase();
  const c = candidate.toLowerCase();
  if (t === c) return 1;
  const levSim = 1 - levenshtein(t, c) / Math.max(t.length, c.length);
  const dice = diceCoefficient(t, c);
  const tokenMatch = tokensOf(t).some((tt) =>
    tokensOf(c).some((ct) => levenshtein(tt, ct) <= 2),
  );
  return dice + levSim * 0.5 + (tokenMatch ? 0.3 : 0);
}

const SUGGESTION_THRESHOLD = 0.35;

function nearestName(target: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestScore = SUGGESTION_THRESHOLD;
  for (const cand of candidates) {
    const score = similarity(target, cand);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

/* ---------------------------------- penelusuran AST ---------------------------------- */

interface ColumnRef {
  table: string | null;
  column: string;
}

interface TableRef {
  table: string;
  alias: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function walkAst(
  node: unknown,
  columns: ColumnRef[],
  tables: TableRef[],
): void {
  if (Array.isArray(node)) {
    for (const item of node) walkAst(item, columns, tables);
    return;
  }
  if (!isRecord(node)) return;

  if (node.type === 'column_ref' && typeof node.column === 'string') {
    columns.push({
      table: typeof node.table === 'string' ? node.table : null,
      column: node.column,
    });
  } else if (
    typeof node.table === 'string' &&
    !('column' in node) &&
    node.type !== 'column_ref'
  ) {
    // Node referensi tabel (FROM / JOIN / target UPDATE): { db, table, as }.
    tables.push({
      table: node.table,
      alias: typeof node.as === 'string' ? node.as : null,
    });
  }

  for (const value of Object.values(node)) walkAst(value, columns, tables);
}

/* ---------------------------------- util teks ---------------------------------- */

/** Perkiraan baris (1-based) tempat token pertama kali muncul di SQL. */
function lineOfToken(sql: string, token: string): number {
  const idx = sql.toLowerCase().indexOf(token.toLowerCase());
  if (idx < 0) return 1;
  return sql.slice(0, idx).split('\n').length;
}

interface ParserErrorShape {
  message?: string;
  location?: { start?: { line?: number; column?: number } };
}

/* ---------------------------------- linter utama ---------------------------------- */

export function lint(sql: string, schema: TableSchema[]): LintError[] {
  const trimmed = sql.trim();
  if (trimmed.length === 0) return [];

  let ast: unknown;
  try {
    ast = parser.astify(trimmed, { database: 'sqlite' });
  } catch (err) {
    const e = err as ParserErrorShape;
    const raw = typeof e?.message === 'string' ? e.message : '';
    // Query terpotong di tengah jalan = pemain masih mengetik. Diam dulu.
    if (/end of input/i.test(raw)) return [];
    const line = e?.location?.start?.line ?? lineOfToken(trimmed, trimmed);
    const column = e?.location?.start?.column;
    return [
      {
        line,
        ...(column !== undefined ? { column } : {}),
        message:
          'Hmm, ada yang belum pas di query ini. Coba periksa lagi ejaan kata kuncinya (SELECT, FROM, WHERE), tanda kurung, dan komanya ya.',
      },
    ];
  }

  if (schema.length === 0) return [];

  const columnRefs: ColumnRef[] = [];
  const tableRefs: TableRef[] = [];
  walkAst(ast, columnRefs, tableRefs);

  const schemaByLower = new Map<string, TableSchema>();
  for (const t of schema) schemaByLower.set(t.table.toLowerCase(), t);

  const errors: LintError[] = [];
  const reported = new Set<string>();

  // Alias & nama tabel yang dipakai query ini → tabel skema.
  const resolvedTables = new Map<string, TableSchema>();
  for (const ref of tableRefs) {
    const found = schemaByLower.get(ref.table.toLowerCase());
    if (found) {
      resolvedTables.set(ref.table.toLowerCase(), found);
      if (ref.alias) resolvedTables.set(ref.alias.toLowerCase(), found);
    } else {
      const key = `table:${ref.table.toLowerCase()}`;
      if (!reported.has(key)) {
        reported.add(key);
        const suggestion = nearestName(
          ref.table,
          schema.map((t) => t.table),
        );
        errors.push({
          line: lineOfToken(trimmed, ref.table),
          message: `Tabel "${ref.table}" tidak ditemukan di database desa.`,
          ...(suggestion
            ? { suggestion: `apakah maksudmu "${suggestion}"?` }
            : {}),
        });
      }
    }
  }

  // Kolom yang boleh dirujuk tanpa kualifikasi: gabungan kolom tabel-tabel
  // yang dipakai query; kalau tidak ada tabel yang dikenal, pakai semua.
  const involvedSchemas =
    resolvedTables.size > 0
      ? [...new Set(resolvedTables.values())]
      : schema;
  const involvedColumns = [...new Set(involvedSchemas.flatMap((t) => t.columns))];

  for (const ref of columnRefs) {
    const column = ref.column;
    if (column === '*') continue;

    if (ref.table) {
      const target = resolvedTables.get(ref.table.toLowerCase());
      if (!target) continue; // tabelnya sendiri sudah dilaporkan / tak dikenal
      if (target.columns.some((c) => c.toLowerCase() === column.toLowerCase())) {
        continue;
      }
      const key = `col:${ref.table.toLowerCase()}.${column.toLowerCase()}`;
      if (reported.has(key)) continue;
      reported.add(key);
      const suggestion = nearestName(column, target.columns);
      errors.push({
        line: lineOfToken(trimmed, column),
        message: `Kolom "${column}" tidak ditemukan di tabel "${target.table}".`,
        ...(suggestion
          ? { suggestion: `apakah maksudmu "${suggestion}"?` }
          : {}),
      });
    } else {
      if (involvedColumns.some((c) => c.toLowerCase() === column.toLowerCase())) {
        continue;
      }
      const key = `col:.${column.toLowerCase()}`;
      if (reported.has(key)) continue;
      reported.add(key);
      const suggestion = nearestName(column, involvedColumns);
      const where =
        involvedSchemas.length === 1
          ? ` di tabel "${involvedSchemas[0].table}"`
          : ' di tabel yang dipakai query ini';
      errors.push({
        line: lineOfToken(trimmed, column),
        message: `Kolom "${column}" tidak ditemukan${where}.`,
        ...(suggestion
          ? { suggestion: `apakah maksudmu "${suggestion}"?` }
          : {}),
      });
    }
  }

  return errors;
}

export const SqlAstLinter = { lint };
