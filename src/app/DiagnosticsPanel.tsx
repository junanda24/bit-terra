import { useCallback, useEffect, useState } from 'react';
import { runDiagnostics, type DiagnosticResult } from './Diagnostics';
import { clearErrorLog, getErrorLog, type ErrorLogEntry } from './errorLog';
import {
  formatErrorLogForClipboard,
  recentErrorEntries,
  summarizeDiagnostics,
} from './diagnosticsPanelModel';

/**
 * "Periksa Kesehatan" panel (self-healing, BLUEPRINT §7). Runs the real
 * diagnostics probes and shows the local error log with copy/clear actions.
 * Results are shown exactly as measured — a failed probe stays failed here;
 * nothing is cosmetically greened.
 */
export function DiagnosticsPanel({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setChecking(true);
    try {
      const res = await runDiagnostics();
      setResults(res);
    } finally {
      setChecking(false);
      setEntries(getErrorLog());
    }
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const handleCopy = useCallback(async () => {
    const text = formatErrorLogForClipboard(getErrorLog());
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Log tersalin ke clipboard.');
    } catch {
      setCopyStatus('Gagal menyalin — browser menolak akses clipboard.');
    }
  }, []);

  const handleClear = useCallback(() => {
    clearErrorLog();
    setEntries([]);
    setCopyStatus('Log error dibersihkan.');
  }, []);

  const summary = results ? summarizeDiagnostics(results) : null;
  const recent = recentErrorEntries(entries, 10);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(10, 13, 18, 0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Panel periksa kesehatan"
    >
      <div
        className="mt-8 w-full max-w-2xl border-4 p-5"
        style={{
          borderColor: 'var(--bt-copper)',
          background: '#1b2230',
          color: 'var(--bt-bezel)',
          fontFamily: '"Pixelify Sans", sans-serif',
        }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            className="text-xs"
            style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-amber)' }}
          >
            PERIKSA KESEHATAN
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runChecks()}
              disabled={checking}
              className="border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: 'var(--bt-bezel)', color: 'var(--bt-bezel)' }}
            >
              {checking ? 'Memeriksa…' : 'Jalankan Ulang'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border-2 px-3 py-1.5 text-sm font-semibold"
              style={{
                borderColor: 'var(--bt-amber)',
                background: 'var(--bt-amber)',
                color: 'var(--bt-slate)',
              }}
            >
              Tutup
            </button>
          </div>
        </div>

        {checking && results === null && (
          <p role="status" className="text-sm">
            Memeriksa mesin-mesin Bit-Terra…
          </p>
        )}

        {summary && (
          <p
            role="status"
            className="mb-3 text-sm font-semibold"
            style={{ color: summary.allOk ? 'var(--bt-mint)' : 'var(--bt-sun)' }}
          >
            {summary.headline}
          </p>
        )}

        {results && (
          <ul className="mb-6 space-y-2">
            {results.map((r) => (
              <li
                key={r.name}
                className="border-2 px-3 py-2"
                style={{ borderColor: r.ok ? 'var(--bt-moss)' : 'var(--bt-coral)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{r.name}</span>
                  <span
                    className="text-xs font-bold tracking-wide"
                    style={{ color: r.ok ? 'var(--bt-mint)' : 'var(--bt-coral)' }}
                  >
                    {r.ok ? 'SEHAT' : 'BERMASALAH'}
                  </span>
                </div>
                <p className="mt-1 text-sm opacity-80">{r.detail}</p>
              </li>
            ))}
          </ul>
        )}

        <h3
          className="mb-2 text-[11px]"
          style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-bezel)' }}
        >
          LOG ERROR TERAKHIR
        </h3>
        {recent.length === 0 ? (
          <p className="mb-4 text-sm opacity-80">
            Belum ada error tercatat. Kabar baik — atau belum ada yang mencoba.
          </p>
        ) : (
          <ul
            className="mb-4 max-h-56 space-y-2 overflow-y-auto text-xs"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {recent.map((e, i) => (
              <li key={`${e.at}-${i}`} className="border px-2 py-1.5" style={{ borderColor: '#334155' }}>
                <span style={{ color: 'var(--bt-sun)' }}>{e.at}</span>{' '}
                <span style={{ color: 'var(--bt-mint)' }}>({e.scope})</span>{' '}
                <span className="break-words">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="border-2 px-3 py-1.5 text-sm font-semibold"
            style={{ borderColor: 'var(--bt-bezel)', color: 'var(--bt-bezel)' }}
          >
            Salin Log
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="border-2 px-3 py-1.5 text-sm font-semibold"
            style={{ borderColor: 'var(--bt-coral)', color: 'var(--bt-coral)' }}
          >
            Bersihkan Log
          </button>
          {copyStatus && (
            <span role="status" className="text-sm" style={{ color: 'var(--bt-mint)' }}>
              {copyStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiagnosticsPanel;
