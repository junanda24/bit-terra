// SqlStatementGuard — penjaga statement tulis + auto-rollback (audit SQL-H1).
//
// Masalahnya: SqliteWasmRunner.runQuery mengeksekusi apa pun yang lolos
// gerbang linter, termasuk UPDATE/DELETE/DROP — dan database sesi tidak
// pernah direset per run, jadi satu eksperimen tulis merusak quest
// baca-saja untuk sisa sesi (bahkan bisa "lulus" sambil menghancurkan
// tabel, probe A1b).
//
// Desain perbaikannya mengikuti fantasi blueprint: AUTO-ROLLBACK.
// - classifySqlStatements memilah statement pemain dengan parser yang
//   sama dengan linter: statement apa pun yang bukan SELECT = tulis.
// - executeGuardedSql membungkus eksekusi: snapshot DB (sql.js export)
//   diambil sebelum run; statement boleh jalan supaya pemain MELIHAT
//   efeknya di hasil pindaian; sesudahnya DB dipulihkan dari snapshot
//   (selalu, untuk quest baca-saja — bukan hanya saat klasifikasi yakin,
//   supaya tidak ada celah lolos). Run yang terkontaminasi ditandai:
//   ia tidak pernah boleh menyelesaikan quest baca-saja.
// - Quest yang memang mendeklarasikan sqlWritesAllowed (Fase 3 Q8)
//   tidak dibungkus sama sekali: tulisannya sah dan persisten.

import { Parser } from 'node-sql-parser';
import type { SqlRunResult } from '../../shared/types';
import { normalizeBracketIdentifiers } from './SqlAstLinter';
import type { SqliteWasmRunner } from './SqliteWasmRunner';

const parser = new Parser();

export interface SqlStatementClassification {
  /** Tipe statement yang terdeteksi, berurutan (mis. ['select', 'drop']). */
  types: string[];
  /** Ada statement non-SELECT (tulis) di input ini. */
  hasWrites: boolean;
  /** Subset types yang merupakan statement tulis. */
  writeTypes: string[];
}

/**
 * Pilah statement SQL pemain. Input yang tidak bisa diparse parser
 * (PRAGMA, BEGIN, teks rusak) menghasilkan klasifikasi kosong — ia akan
 * gagal di lapisan lain (gerbang linter / error runtime), bukan di sini.
 */
export function classifySqlStatements(sql: string): SqlStatementClassification {
  const trimmed = sql.trim();
  if (trimmed.length === 0) return { types: [], hasWrites: false, writeTypes: [] };
  let ast: unknown;
  try {
    ast = parser.astify(normalizeBracketIdentifiers(trimmed), {
      database: 'sqlite',
    });
  } catch {
    return { types: [], hasWrites: false, writeTypes: [] };
  }
  const statements = Array.isArray(ast) ? ast : [ast];
  const types: string[] = [];
  for (const stmt of statements) {
    if (
      typeof stmt === 'object' &&
      stmt !== null &&
      typeof (stmt as { type?: unknown }).type === 'string'
    ) {
      types.push((stmt as { type: string }).type);
    }
  }
  const writeTypes = types.filter((t) => t !== 'select');
  return { types, hasWrites: writeTypes.length > 0, writeTypes };
}

export interface GuardedSqlOutcome {
  result: SqlRunResult;
  classification: SqlStatementClassification;
  /**
   * Run ini mengandung statement tulis padahal quest-nya baca-saja.
   * Efek tulisannya sudah di-rollback; run ini TIDAK boleh menyelesaikan
   * quest — pemain mendapat narasi rollback.
   */
  contaminated: boolean;
}

/**
 * Jalankan SQL pemain dengan pembungkus auto-rollback. Untuk quest
 * baca-saja (writesAllowed=false): snapshot → eksekusi → pulihkan,
 * termasuk saat eksekusi melempar di tengah multi-statement (statement
 * awal yang sudah sempat menulis ikut dipulihkan sebelum error diteruskan).
 */
export function executeGuardedSql(
  runner: SqliteWasmRunner,
  sql: string,
  writesAllowed: boolean,
): GuardedSqlOutcome {
  const classification = classifySqlStatements(sql);
  const contaminated = !writesAllowed && classification.hasWrites;
  const snapshot = writesAllowed ? null : runner.exportSnapshot();
  try {
    const result = runner.runQuery(sql);
    if (snapshot) runner.restoreSnapshot(snapshot);
    return { result, classification, contaminated };
  } catch (err) {
    if (snapshot) {
      try {
        runner.restoreSnapshot(snapshot);
      } catch {
        // Pemulihan gagal tidak boleh menelan error asli pemain.
      }
    }
    throw err;
  }
}

/**
 * Narasi rollback yang diucapkan Piko (lewat funnyFail textOverride) saat
 * run pemain terkontaminasi statement tulis di quest baca-saja: hangat,
 * lucu, dan menjelaskan mekanismenya — eksperimennya terlihat efeknya,
 * lalu desa "mengembalikan" perubahannya.
 */
export const SQL_ROLLBACK_NARRATION =
  'Whoa, pelan-pelan, Fixer — perintahmu barusan benar-benar MENGUBAH isi tabel desa! Kamu memang sempat melihat efeknya, tapi misi ini sifatnya hanya membaca, jadi Pohon Induk memutar balik waktu desa dan mengembalikan (rollback) semua perubahanmu seperti semula. Tabelnya utuh lagi, tidak ada yang rusak, kok. Untuk misi ini, jawabanmu harus murni hasil membaca dengan SELECT, ya.';
