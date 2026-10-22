/**
 * Diagnostics (self-healing pass, docs/BLUEPRINT.md §7).
 * runDiagnostics() probes the four things the game cannot live without and
 * reports honestly — a missing sandbox module or a blocked WASM is a red
 * result with a reason, never a fake green. This module never throws.
 */
import { SAVE_DB_NAME } from '../core/persistence/saveSystem';

export interface DiagnosticResult {
  name: string;
  ok: boolean;
  detail: string;
}

interface SqlRunnerLike {
  init: (seedScript: string) => Promise<void> | void;
  runQuery: (sql: string) => { columns: string[]; rows: unknown[] };
  dispose?: () => void;
}

function asRunner(candidate: unknown): SqlRunnerLike | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const obj = candidate as Record<string, unknown>;
  if (typeof obj.init === 'function' && typeof obj.runQuery === 'function') {
    return candidate as SqlRunnerLike;
  }
  return null;
}

async function checkSqlWasm(): Promise<DiagnosticResult> {
  const name = 'Mesin SQL (SQL.js WASM)';
  let mod: Record<string, unknown>;
  try {
    mod = (await import('../sandbox/sql/SqliteWasmRunner')) as Record<string, unknown>;
  } catch {
    return {
      name,
      ok: false,
      detail: 'Modul sandbox SQL belum tersedia — mode SQL belum bisa dijalankan.',
    };
  }
  try {
    const exported = (mod.SqliteWasmRunner ?? mod.default) as unknown;
    let runner = asRunner(exported);
    if (!runner && typeof exported === 'function') {
      const Ctor = exported as new () => unknown;
      runner = asRunner(new Ctor());
    }
    if (!runner) {
      return { name, ok: false, detail: 'Modul SQL ditemukan, tapi bentuk API-nya tidak dikenal.' };
    }
    await runner.init('CREATE TABLE __probe (a INTEGER); INSERT INTO __probe VALUES (7);');
    const res = runner.runQuery('SELECT a FROM __probe');
    try {
      runner.dispose?.();
    } catch {
      /* dispose is best-effort */
    }
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    return rows.length === 1
      ? { name, ok: true, detail: 'WASM termuat; query uji 1x1 menghasilkan 1 baris.' }
      : { name, ok: false, detail: 'Query uji tidak menghasilkan baris yang diharapkan.' };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: `Gagal menjalankan uji SQL: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkIndexedDb(): Promise<DiagnosticResult> {
  const name = 'Penyimpanan progres (IndexedDB)';
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: DiagnosticResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(
      () =>
        done({ name, ok: false, detail: 'Pemeriksaan IndexedDB melewati batas waktu (3 detik).' }),
      3000,
    );
    try {
      if (typeof indexedDB === 'undefined') {
        done({ name, ok: false, detail: 'IndexedDB tidak tersedia di lingkungan ini.' });
        return;
      }
      // Probe the REAL save database by name (audit CORE-M4: probing a
      // throwaway 'bit-terra-diagnostics' DB reported green exactly when
      // the game's own DB was the broken one). Opened WITHOUT a version:
      // an existing DB opens as-is; a missing one fires upgradeneeded,
      // which we abort so the probe never creates an empty shell that
      // would shadow the schema Dexie builds on first save.
      let abortedAsNew = false;
      const req = indexedDB.open(SAVE_DB_NAME);
      req.onupgradeneeded = () => {
        abortedAsNew = true;
        try {
          req.transaction?.abort();
        } catch {
          /* ignore */
        }
      };
      req.onerror = () => {
        if (abortedAsNew) {
          done({
            name,
            ok: true,
            detail: `IndexedDB tersedia; database save "${SAVE_DB_NAME}" belum terbentuk (pemain baru) — dibuat saat autosave pertama.`,
          });
        } else {
          done({
            name,
            ok: false,
            detail: `Database save "${SAVE_DB_NAME}" menolak dibuka: ${req.error?.message ?? 'alasan tidak dikenal'}`,
          });
        }
      };
      req.onblocked = () =>
        done({
          name,
          ok: false,
          detail: `Database save "${SAVE_DB_NAME}" sedang dikunci oleh koneksi lain.`,
        });
      req.onsuccess = () => {
        const version = req.result.version;
        try {
          req.result.close();
        } catch {
          /* ignore */
        }
        done({
          name,
          ok: true,
          detail: `Database save "${SAVE_DB_NAME}" bisa dibuka (versi ${version}).`,
        });
      };
    } catch (err) {
      done({
        name,
        ok: false,
        detail: `IndexedDB gagal: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

function checkAudioContext(): DiagnosticResult {
  const name = 'Audio (AudioContext)';
  try {
    if (typeof window === 'undefined') {
      return { name, ok: false, detail: 'Tidak ada window — audio tidak bisa dibuat.' };
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return { name, ok: false, detail: 'Browser tidak menyediakan AudioContext.' };
    const ctx = new Ctor();
    const state = ctx.state;
    void ctx.close();
    return { name, ok: true, detail: `AudioContext bisa dibuat (state awal: ${state}).` };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: `AudioContext gagal dibuat: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkLocalStorage(): DiagnosticResult {
  const name = 'Penyimpanan lokal (localStorage)';
  try {
    const key = 'bitterra:diagnostics-probe';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return { name, ok: true, detail: 'localStorage bisa ditulis dan dibaca.' };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: `localStorage tidak bisa ditulis: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Run all checks. Always resolves; failures are data, not exceptions. */
export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const [sql, idb] = await Promise.all([checkSqlWasm(), checkIndexedDb()]);
  return [sql, idb, checkAudioContext(), checkLocalStorage()];
}

export default runDiagnostics;
