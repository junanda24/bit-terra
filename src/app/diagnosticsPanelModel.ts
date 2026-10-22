/**
 * Pure data-shaping for the DiagnosticsPanel (self-healing, BLUEPRINT §7).
 * Kept free of DOM/React so the panel's wording is unit-testable: the panel
 * must never claim "semua sehat" when a check failed.
 */

import type { DiagnosticResult } from './Diagnostics';
import type { ErrorLogEntry } from './errorLog';

export interface HealthSummary {
  total: number;
  passed: number;
  allOk: boolean;
  headline: string;
}

export function summarizeDiagnostics(results: DiagnosticResult[]): HealthSummary {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const allOk = total > 0 && passed === total;
  const headline =
    total === 0
      ? 'Belum ada hasil pemeriksaan.'
      : allOk
        ? 'Semua sistem sehat.'
        : `${passed} dari ${total} pemeriksaan lolos — yang gagal tertulis di bawah.`;
  return { total, passed, allOk, headline };
}

/** Newest first, capped — the panel shows recent trouble, not archaeology. */
export function recentErrorEntries(
  entries: ErrorLogEntry[],
  limit = 10,
): ErrorLogEntry[] {
  return entries.slice(-limit).reverse();
}

export function formatErrorLogForClipboard(entries: ErrorLogEntry[]): string {
  if (entries.length === 0) return 'Log error Bit-Terra: kosong.';
  const lines = entries.map((e) => {
    const head = `[${e.at}] (${e.scope}) ${e.message}`;
    return e.stack ? `${head}\n${e.stack}` : head;
  });
  return ['Log error Bit-Terra:', ...lines].join('\n');
}
