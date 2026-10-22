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

/** Lepas satu lapis pembungkus identifier: [x] / "x" / `x` → x. */
function cleanIdent(name: string): string {
  if (name.length >= 2) {
    const first = name[0];
    const last = name[name.length - 1];
    if (
      (first === '[' && last === ']') ||
      (first === '"' && last === '"') ||
      (first === '`' && last === '`')
    ) {
      return name.slice(1, -1);
    }
  }
  return name;
}

/**
 * node-sql-parser (mode sqlite) MENOLAK identifier kurung siku [kolom]
 * yang sah di SQLite asli (audit SQL-H2/C6), jadi sebelum diparse, kurung
 * siku di luar string/komentar ditukar menjadi identifier backtick —
 * sama-sama diterima SQLite asli, dan parser membacanya sebagai
 * column_ref sungguhan (kutip ganda tidak bisa dipakai: parser membacanya
 * sebagai string literal). Selama nama di dalam kurung tidak mengandung
 * backtick, penukarannya 1 karakter : 1 karakter dan nomor baris utuh.
 * String ('...', "..."), identifier backtick, dan komentar tidak disentuh.
 */
export function normalizeBracketIdentifiers(sql: string): string {
  let out = '';
  let i = 0;
  let state: 'code' | 'single' | 'double' | 'backtick' | 'line' | 'block' =
    'code';
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1] ?? '';
    if (state === 'code') {
      if (ch === "'") state = 'single';
      else if (ch === '"') state = 'double';
      else if (ch === '`') state = 'backtick';
      else if (ch === '-' && next === '-') state = 'line';
      else if (ch === '/' && next === '*') state = 'block';
      else if (ch === '[') {
        const close = sql.indexOf(']', i + 1);
        if (close === -1) {
          out += ch;
          i++;
          continue;
        }
        out += '`' + sql.slice(i + 1, close).replace(/`/g, '``') + '`';
        i = close + 1;
        continue;
      }
      out += ch;
      i++;
    } else if (state === 'single') {
      out += ch;
      i++;
      if (ch === "'") {
        if (next === "'") {
          out += next;
          i++;
        } else state = 'code';
      }
    } else if (state === 'double') {
      out += ch;
      i++;
      if (ch === '"') {
        if (next === '"') {
          out += next;
          i++;
        } else state = 'code';
      }
    } else if (state === 'backtick') {
      out += ch;
      i++;
      if (ch === '`') state = 'code';
    } else if (state === 'line') {
      out += ch;
      i++;
      if (ch === '\n') state = 'code';
    } else {
      // block comment
      out += ch;
      i++;
      if (ch === '*' && next === '/') {
        out += next;
        i++;
        state = 'code';
      }
    }
  }
  return out;
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
      table: typeof node.table === 'string' ? cleanIdent(node.table) : null,
      column: cleanIdent(node.column),
    });
  } else if (
    typeof node.table === 'string' &&
    !('column' in node) &&
    node.type !== 'column_ref'
  ) {
    // Node referensi tabel (FROM / JOIN / target UPDATE): { db, table, as }.
    tables.push({
      table: cleanIdent(node.table),
      alias: typeof node.as === 'string' ? cleanIdent(node.as) : null,
    });
  }

  for (const value of Object.values(node)) walkAst(value, columns, tables);
}

/* ------------------------- alias output & CTE (SQL-H2) ------------------------- */

/**
 * Kolom proyeksi sebuah select: untuk tiap item daftar SELECT, namanya
 * adalah alias (`AS x`) bila ada, else nama kolom bila itemnya column_ref
 * polos. Mengembalikan null bila ada item yang namanya tidak bisa
 * ditentukan (SELECT * / ekspresi tanpa alias) — proyeksi "tidak dikenal".
 */
function projectedColumnsOfSelect(selectNode: Record<string, unknown>): string[] | null {
  if (!Array.isArray(selectNode.columns)) return null;
  const names: string[] = [];
  for (const item of selectNode.columns) {
    if (!isRecord(item)) return null;
    if (typeof item.as === 'string' && item.as.length > 0) {
      names.push(cleanIdent(item.as));
      continue;
    }
    const expr = item.expr;
    if (
      isRecord(expr) &&
      expr.type === 'column_ref' &&
      typeof expr.column === 'string' &&
      expr.column !== '*'
    ) {
      names.push(cleanIdent(expr.column));
      continue;
    }
    return null;
  }
  return names;
}

interface SelectInfo {
  /** Alias output (huruf kecil) dari semua select di query. */
  outputAliases: Set<string>;
  /**
   * Kunci "tabel|kolom" (huruf kecil) untuk column_ref yang muncul di
   * klausa ORDER BY / GROUP BY / HAVING — satu-satunya tempat SQLite
   * mengizinkan merujuk alias output.
   */
  aliasContextRefs: Set<string>;
  /** Nama CTE (huruf kecil) → skema semu hasil proyeksinya. */
  cteSchemas: Map<string, TableSchema>;
}

/** Skema semu satu entri WITH: nama + kolom proyeksinya. */
function cteSchemaOf(
  entry: Record<string, unknown>,
  fallbackColumns: string[],
): { name: string; schema: TableSchema } | null {
  const rawName =
    typeof entry.name === 'string'
      ? entry.name
      : isRecord(entry.name) && typeof entry.name.value === 'string'
        ? entry.name.value
        : null;
  if (!rawName) return null;
  const name = cleanIdent(rawName);
  // Kolom CTE: daftar eksplisit WITH x(a, b) menang; kalau tidak ada,
  // turunkan dari proyeksi select di dalamnya.
  let columns: string[] | null = null;
  if (Array.isArray(entry.columns) && entry.columns.length > 0) {
    const names = entry.columns.map((c) =>
      isRecord(c) && typeof c.column === 'string'
        ? cleanIdent(c.column)
        : typeof c === 'string'
          ? cleanIdent(c)
          : null,
    );
    columns = names.every((n) => n !== null) ? (names as string[]) : null;
  } else if (isRecord(entry.stmt)) {
    const inner = isRecord(entry.stmt.ast) ? entry.stmt.ast : entry.stmt;
    columns = projectedColumnsOfSelect(inner);
  }
  return {
    name,
    schema: { table: name, columns: columns ?? fallbackColumns },
  };
}

function collectSelectInfo(
  node: unknown,
  info: SelectInfo,
  fallbackColumns: string[],
): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSelectInfo(item, info, fallbackColumns);
    return;
  }
  if (!isRecord(node)) return;

  if (node.type === 'select') {
    if (Array.isArray(node.columns)) {
      for (const item of node.columns) {
        if (isRecord(item) && typeof item.as === 'string' && item.as.length > 0) {
          info.outputAliases.add(cleanIdent(item.as).toLowerCase());
        }
      }
    }
    for (const clause of ['orderby', 'groupby', 'having'] as const) {
      const sub = node[clause];
      if (sub === undefined || sub === null) continue;
      const cols: ColumnRef[] = [];
      const tbls: TableRef[] = [];
      walkAst(sub, cols, tbls);
      for (const c of cols) {
        info.aliasContextRefs.add(
          `${(c.table ?? '').toLowerCase()}|${c.column.toLowerCase()}`,
        );
      }
    }
    if (Array.isArray(node.with)) {
      for (const entry of node.with) {
        if (!isRecord(entry)) continue;
        const cte = cteSchemaOf(entry, fallbackColumns);
        if (cte) info.cteSchemas.set(cte.name.toLowerCase(), cte.schema);
      }
    }
  }

  for (const value of Object.values(node)) {
    collectSelectInfo(value, info, fallbackColumns);
  }
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
    // Kurung siku [kolom] sah di SQLite tapi ditolak parser — normalkan
    // dulu (posisi tidak bergeser, nomor baris tetap akurat).
    ast = parser.astify(normalizeBracketIdentifiers(trimmed), {
      database: 'sqlite',
    });
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

  const errors: LintError[] = [];
  const seen = new Set<string>();
  const pushAll = (list: LintError[]) => {
    for (const e of list) {
      const key = `${e.line}|${e.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push(e);
    }
  };

  // Pra-validasi badan CTE: kolom proyeksi CTE tidak boleh menutupi
  // kesalahan DI DALAM badannya sendiri — `WITH l AS (SELECT nama_domba
  // FROM t) SELECT * FROM l` harus tetap menuduh nama_domba, bukan lolos
  // karena "nama_domba adalah kolom l". Badan divalidasi mandiri terhadap
  // skema asli + CTE pendahulu dalam WITH yang sama (CTE berantai).
  for (const body of collectCteBodies(ast, schema)) {
    pushAll(validateAst(body.ast, body.schema, trimmed));
  }
  pushAll(validateAst(ast, schema, trimmed));
  return errors;
}

/** Kumpulkan badan tiap CTE di seluruh pohon AST + skema validasinya. */
function collectCteBodies(
  node: unknown,
  baseSchema: TableSchema[],
  out: { ast: unknown; schema: TableSchema[] }[] = [],
): { ast: unknown; schema: TableSchema[] }[] {
  if (Array.isArray(node)) {
    for (const item of node) collectCteBodies(item, baseSchema, out);
    return out;
  }
  if (!isRecord(node)) return out;

  if (node.type === 'select' && Array.isArray(node.with)) {
    const fallback = [...new Set(baseSchema.flatMap((t) => t.columns))];
    const earlier: TableSchema[] = [];
    for (const entry of node.with) {
      if (!isRecord(entry)) continue;
      if (isRecord(entry.stmt)) {
        const bodyAst = isRecord(entry.stmt.ast) ? entry.stmt.ast : entry.stmt;
        out.push({ ast: bodyAst, schema: [...baseSchema, ...earlier] });
      }
      const cte = cteSchemaOf(entry, fallback);
      if (cte) earlier.push(cte.schema);
    }
  }

  for (const value of Object.values(node)) {
    collectCteBodies(value, baseSchema, out);
  }
  return out;
}

/** Validasi satu pohon AST terhadap skema (dipakai lint + pra-pass CTE). */
function validateAst(
  ast: unknown,
  schema: TableSchema[],
  trimmed: string,
): LintError[] {
  const columnRefs: ColumnRef[] = [];
  const tableRefs: TableRef[] = [];
  walkAst(ast, columnRefs, tableRefs);

  const schemaByLower = new Map<string, TableSchema>();
  for (const t of schema) schemaByLower.set(t.table.toLowerCase(), t);

  // Alias output, konteks alias (ORDER BY/GROUP BY/HAVING), dan CTE —
  // tiga hal yang dulu dituduh "tidak ditemukan" padahal sah (SQL-H2).
  const allSchemaColumns = [...new Set(schema.flatMap((t) => t.columns))];
  const selectInfo: SelectInfo = {
    outputAliases: new Set(),
    aliasContextRefs: new Set(),
    cteSchemas: new Map(),
  };
  collectSelectInfo(ast, selectInfo, allSchemaColumns);

  const errors: LintError[] = [];
  const reported = new Set<string>();

  // Alias & nama tabel yang dipakai query ini → tabel skema.
  // Nama CTE menang atas tabel asli bila bertabrakan (semantik SQLite).
  const resolvedTables = new Map<string, TableSchema>();
  for (const ref of tableRefs) {
    const found =
      selectInfo.cteSchemas.get(ref.table.toLowerCase()) ??
      schemaByLower.get(ref.table.toLowerCase());
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
      // Rujukan ke alias output dari klausa ORDER BY / GROUP BY / HAVING
      // itu sah di SQLite (SQL-H2/C3) — tapi HANYA di klausa itu; alias
      // yang dirujuk di WHERE tetap dilaporkan seperti sebelumnya.
      if (
        selectInfo.outputAliases.has(column.toLowerCase()) &&
        selectInfo.aliasContextRefs.has(`|${column.toLowerCase()}`)
      ) {
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
