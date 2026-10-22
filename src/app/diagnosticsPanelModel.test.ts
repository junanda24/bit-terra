import { describe, expect, it } from 'vitest';
import type { DiagnosticResult } from './Diagnostics';
import type { ErrorLogEntry } from './errorLog';
import {
  formatErrorLogForClipboard,
  recentErrorEntries,
  summarizeDiagnostics,
} from './diagnosticsPanelModel';

const ok = (name: string): DiagnosticResult => ({ name, ok: true, detail: 'baik' });
const bad = (name: string): DiagnosticResult => ({ name, ok: false, detail: 'rusak' });

describe('summarizeDiagnostics', () => {
  it('reports all-healthy only when every check passed', () => {
    const s = summarizeDiagnostics([ok('A'), ok('B')]);
    expect(s).toMatchObject({ total: 2, passed: 2, allOk: true });
    expect(s.headline).toBe('Semua sistem sehat.');
  });

  it('never claims healthy when a check failed', () => {
    const s = summarizeDiagnostics([ok('A'), bad('B'), ok('C')]);
    expect(s.allOk).toBe(false);
    expect(s.passed).toBe(2);
    expect(s.headline).toContain('2 dari 3');
  });

  it('handles an empty result set honestly', () => {
    const s = summarizeDiagnostics([]);
    expect(s.allOk).toBe(false);
    expect(s.headline).toContain('Belum ada hasil');
  });
});

describe('recentErrorEntries', () => {
  const entries: ErrorLogEntry[] = Array.from({ length: 15 }, (_, i) => ({
    at: `2026-10-22T00:00:${String(i).padStart(2, '0')}Z`,
    scope: 'test',
    message: `err-${i}`,
  }));

  it('returns newest first, capped at the limit', () => {
    const recent = recentErrorEntries(entries, 10);
    expect(recent).toHaveLength(10);
    expect(recent[0].message).toBe('err-14');
    expect(recent[9].message).toBe('err-5');
  });

  it('returns everything when fewer than the limit', () => {
    expect(recentErrorEntries(entries.slice(0, 3))).toHaveLength(3);
  });
});

describe('formatErrorLogForClipboard', () => {
  it('formats entries with timestamp, scope and message', () => {
    const text = formatErrorLogForClipboard([
      { at: '2026-10-22T01:00:00Z', scope: 'sql-init', message: 'wasm gagal' },
    ]);
    expect(text).toContain('[2026-10-22T01:00:00Z] (sql-init) wasm gagal');
  });

  it('says so when the log is empty', () => {
    expect(formatErrorLogForClipboard([])).toContain('kosong');
  });
});
