import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { SqlRunResult } from '../../shared/types';

type Row = Record<string, unknown>;

/** Kunci stabil untuk membandingkan dua baris hasil query. */
export function rowKey(row: Row): string {
  return JSON.stringify(
    Object.keys(row)
      .sort()
      .map((k) => [k, row[k] ?? null]),
  );
}

export function rowInSet(row: Row, keys: Set<string>): boolean {
  return keys.has(rowKey(row));
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span style={{ color: '#5b6b7f', fontStyle: 'italic' }}>NULL</span>;
  }
  return <>{String(value)}</>;
}

export interface SqlTableVisualizerProps {
  /** Hasil query terakhir (dari SqliteWasmRunner via SQL_RESULT). */
  result: SqlRunResult | null;
  /**
   * Seluruh baris tabel sumber, bila tersedia. Saat `scanning` aktif, baris
   * sumber dipindai satu per satu; yang cocok dengan hasil menyala hijau lalu
   * "terbang" masuk ke tabel hasil di bawahnya.
   */
  sourceRows?: Row[] | null;
  scanning?: boolean;
  /** Dipanggil sekali saat animasi pindai selesai. */
  onScanComplete?: () => void;
  scanStepMs?: number;
}

type ScanPhase = 'idle' | 'scanning' | 'done';

/**
 * Visualizer hasil SQL bergaya pixel + efek Data Scanner (BLUEPRINT §6):
 * sinar pindai menyapu baris, baris cocok menyala mint dan berkumpul jadi
 * tabel hasil. Tanpa sourceRows, tabel hasil tetap muncul baris demi baris.
 */
export function SqlTableVisualizer({
  result,
  sourceRows = null,
  scanning = false,
  onScanComplete,
  scanStepMs = 95,
}: SqlTableVisualizerProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [scanIdx, setScanIdx] = useState(-1);
  const [revealed, setRevealed] = useState(0);
  const completeRef = useRef(false);
  const onScanCompleteRef = useRef(onScanComplete);
  onScanCompleteRef.current = onScanComplete;

  const resultKeys = useMemo(
    () => new Set((result?.rows ?? []).map(rowKey)),
    [result],
  );

  const scanList = sourceRows ?? result?.rows ?? [];
  const total = scanList.length;

  useEffect(() => {
    if (!scanning || !result) {
      if (!scanning) {
        setPhase('idle');
        setScanIdx(-1);
        setRevealed(result?.rows.length ?? 0);
      }
      return;
    }
    completeRef.current = false;
    setPhase('scanning');
    setScanIdx(-1);
    setRevealed(0);
    let idx = -1;
    const id = window.setInterval(() => {
      idx += 1;
      if (idx >= total) {
        window.clearInterval(id);
        setPhase('done');
        setRevealed(result.rows.length);
        if (!completeRef.current) {
          completeRef.current = true;
          onScanCompleteRef.current?.();
        }
        return;
      }
      setScanIdx(idx);
      if (!sourceRows) setRevealed(idx + 1);
    }, scanStepMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, result, total, scanStepMs]);

  // Baris hasil yang sudah "terkumpul": saat memindai sumber, baris yang
  // cocok muncul mengikuti urutan pindai; selain itu mengikuti `revealed`.
  const visibleResultRows = useMemo(() => {
    if (!result) return [];
    if (phase !== 'scanning') return result.rows;
    if (sourceRows) {
      const matched: Row[] = [];
      for (let i = 0; i <= scanIdx && i < sourceRows.length; i++) {
        if (resultKeys.has(rowKey(sourceRows[i]))) matched.push(sourceRows[i]);
      }
      return matched;
    }
    return result.rows.slice(0, revealed);
  }, [result, phase, sourceRows, scanIdx, resultKeys, revealed]);

  if (!result && phase !== 'scanning') {
    return (
      <div
        className="grid h-full min-h-[120px] place-items-center px-4 text-center"
        style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
      >
        <p className="text-[14.5px] leading-relaxed">
          Belum ada data yang dipindai.
          <br />
          Tulis query di editor, lalu tarik tuas <b style={{ color: '#ffb000' }}>RUN</b>.
        </p>
      </div>
    );
  }

  const columns = result?.columns ?? (scanList[0] ? Object.keys(scanList[0]) : []);

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2.5">
      {/* Panel pindai sumber */}
      {sourceRows && phase !== 'idle' ? (
        <div
          className="relative max-h-[38%] overflow-hidden rounded-[3px] p-1.5"
          style={{ backgroundColor: '#0b0e14', border: '2px solid rgba(0,0,0,0.6)' }}
        >
          <div
            className="mb-1 px-1 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#ffb000' }}
          >
            {phase === 'scanning' ? `Memindai baris ${Math.min(scanIdx + 1, total)} / ${total}` : 'Pemindaian selesai'}
          </div>
          <div className="space-y-[3px]">
            {sourceRows.map((row, i) => {
              const matched = resultKeys.has(rowKey(row));
              const state =
                phase === 'done' || i < scanIdx
                  ? matched
                    ? 'matched'
                    : 'dimmed'
                  : i === scanIdx
                    ? 'active'
                    : 'pending';
              return (
                <div
                  key={i}
                  className="truncate rounded-[2px] px-2 py-[3px] text-[11.5px] transition-colors duration-150"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: state === 'matched' ? '#0b2b25' : state === 'dimmed' ? '#54606f' : '#d8ccb8',
                    backgroundColor:
                      state === 'matched'
                        ? '#00f5d4'
                        : state === 'active'
                          ? 'rgba(255,176,0,0.3)'
                          : 'rgba(255,255,255,0.03)',
                    opacity: state === 'dimmed' ? 0.45 : 1,
                    boxShadow: state === 'active' ? 'inset 0 0 0 2px #ffb000' : undefined,
                  }}
                >
                  {columns.map((c) => String(row[c] ?? 'NULL')).join(' · ')}
                </div>
              );
            })}
          </div>
          {phase === 'scanning' ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-[26px]"
              style={{
                background:
                  'linear-gradient(180deg, transparent, rgba(0,245,212,0.16), transparent)',
              }}
              animate={{ top: ['-10%', '105%'] }}
              transition={{ duration: Math.max(0.4, (total * scanStepMs) / 1000), ease: 'linear' }}
            />
          ) : null}
        </div>
      ) : null}

      {/* Tabel hasil */}
      <div
        className="min-h-0 flex-1 overflow-auto rounded-[3px]"
        style={{ backgroundColor: '#0e1118', border: '2px solid rgba(0,0,0,0.6)' }}
      >
        <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="sticky top-0 px-2.5 py-1.5 text-left text-[12px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: '#ffb000',
                    color: '#141820',
                    borderBottom: '3px solid rgba(0,0,0,0.55)',
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {visibleResultRows.map((row, i) => (
                <motion.tr
                  key={rowKey(row) + i}
                  initial={{ opacity: 0, y: -10, backgroundColor: 'rgba(0,245,212,0.35)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,245,212,0)' }}
                  transition={{ duration: 0.28 }}
                  style={{ borderBottom: '1px solid rgba(216,204,184,0.12)' }}
                >
                  {columns.map((c) => (
                    <td key={c} className="px-2.5 py-[5px] text-[12.5px]" style={{ color: '#f2ead6' }}>
                      <CellValue value={row[c]} />
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {result && visibleResultRows.length === 0 && phase !== 'scanning' ? (
          <p
            className="px-3 py-3 text-[13.5px]"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
          >
            Query jalan, tapi tidak ada baris yang cocok. Bukan akhir dunia — coba longgarkan
            syaratnya sedikit.
          </p>
        ) : null}
        {result ? (
          <p
            className="px-3 py-1.5 text-right text-[11.5px]"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: '#54606f' }}
          >
            {visibleResultRows.length} baris hasil
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default SqlTableVisualizer;
