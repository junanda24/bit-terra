// SqliteWasmRunner — SQLite asli (sql.js / WASM) yang berjalan 100% di
// memori browser, tanpa server. Satu instance = satu database in-memory;
// init() selalu membuat database baru dari seed script quest.
//
// Kontrak: docs/BLUEPRINT.md §5 (Sandbox API). Tipe hasil memakai
// SqlRunResult & TableSchema dari src/shared/types.ts.

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { SqlRunResult, TableSchema } from '../../shared/types';

// tsconfig proyek membatasi "types" ke vite/client saja, jadi global
// `process` diakses struktural lewat globalThis (tanpa @types/node).
interface NodeProcessLike {
  cwd?: () => string;
}
const nodeProcess: NodeProcessLike | undefined = (
  globalThis as { process?: NodeProcessLike }
).process;
const nodeCwd: string | null =
  typeof window === 'undefined' && typeof nodeProcess?.cwd === 'function'
    ? nodeProcess.cwd()
    : null;

/**
 * Di browser, Vite menyajikan file wasm lokal lewat import `?url` di atas.
 * Di Node/Vitest, import `?url` bisa menghasilkan path dev-server (/@fs/...)
 * atau path relatif root — normalkan menjadi path filesystem asli di
 * node_modules agar sql.js bisa membacanya lewat fs.
 */
function locateWasmFile(file: string): string {
  if (nodeCwd === null) return sqlWasmUrl;
  let candidate = sqlWasmUrl;
  if (candidate.startsWith('/@fs/')) {
    candidate = candidate.slice('/@fs'.length);
  } else if (candidate.startsWith('/node_modules/')) {
    candidate = nodeCwd + candidate;
  }
  if (candidate.includes('/node_modules/sql.js/dist/') && candidate.endsWith('.wasm')) {
    return candidate;
  }
  return `${nodeCwd}/node_modules/sql.js/dist/${file}`;
}

// WASM runtime dimuat sekali saja, dipakai ulang semua instance.
let sqlStaticPromise: Promise<SqlJsStatic> | null = null;
function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlStaticPromise) {
    sqlStaticPromise = initSqlJs({ locateFile: locateWasmFile });
  }
  return sqlStaticPromise;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export class SqliteWasmRunner {
  private db: Database | null = null;

  /** Buat database in-memory BARU lalu jalankan seed script di atasnya. */
  async init(seedScript: string): Promise<void> {
    this.dispose();
    const SQL = await loadSqlJs();
    this.db = new SQL.Database();
    if (seedScript.trim().length > 0) {
      // Error seed = error SQLite mentah, diteruskan apa adanya.
      this.db.exec(seedScript);
    }
  }

  /**
   * Jalankan SQL pemain. Mengembalikan result set terakhir (untuk input
   * multi-statement seperti UPDATE lalu SELECT). Statement yang tidak
   * menghasilkan baris (INSERT/UPDATE/DDL) memberi { columns: [], rows: [] }.
   * Error dilempar sebagai Error berisi pesan mentah SQLite — penerjemahan
   * ke bahasa ramah dilakukan lapisan lain (FriendlyErrorTranslator).
   */
  runQuery(sql: string): SqlRunResult {
    const db = this.requireDb();
    let results;
    try {
      results = db.exec(sql);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    if (results.length === 0) return { columns: [], rows: [] };
    const last = results[results.length - 1];
    const rows: Record<string, unknown>[] = last.values.map((values) => {
      const row: Record<string, unknown> = {};
      last.columns.forEach((col, i) => {
        row[col] = values[i] ?? null;
      });
      return row;
    });
    return { columns: [...last.columns], rows };
  }

  /** Skema aktif: semua tabel (selain internal sqlite) + kolomnya. */
  getSchema(): TableSchema[] {
    const db = this.requireDb();
    const tablesRes = db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    if (tablesRes.length === 0) return [];
    return tablesRes[0].values.map((row) => {
      const table = String(row[0]);
      const pragma = db.exec(`PRAGMA table_info(${quoteIdent(table)})`);
      const columns =
        pragma.length === 0 ? [] : pragma[0].values.map((r) => String(r[1]));
      return { table, columns };
    });
  }

  dispose(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private requireDb(): Database {
    if (!this.db) {
      throw new Error(
        'Database belum siap. Panggil init() dulu sebelum menjalankan query.',
      );
    }
    return this.db;
  }
}
