import type { QuestDefinition } from '../../shared/types';
import type { PersistedProgress } from '../../core/bridge/gameStore';
import { ResultDiffChecker } from '../../sandbox/sql/ResultDiffChecker';

/**
 * Logika murni quest HYBRID (Fase 3 Q8) — diekstrak dari CyberDeckScreen
 * supaya verdict fase SQL dan mekanik dua-fase bisa diuji tanpa DOM:
 *
 * - Fase 1 quest HYBRID dinilai dari KEADAAN AKHIR tabel, bukan output
 *   SELECT pemain (pemain memang harus menulis UPDATE). Hasil penilaian
 *   dibedakan tiga kegagalan yang jujur: masih ada baris rusak
 *   (still_corrupt), baris sehat ikut berubah/hilang (innocent_changed),
 *   dan sisanya (wrong_result).
 * - Kode pemain dua fase disimpan di dua kunci codeByQuest: fase 1 memakai
 *   id quest polos (kompatibel dengan semua quest lain), fase 2 memakai
 *   sufiks ':fase2'.
 */

export type HybridPhase = 1 | 2;

/** Kunci penyimpanan kode per fase di codeByQuest. */
export function hybridPhaseCodeKey(questId: string, phase: HybridPhase): string {
  return phase === 2 ? `${questId}:fase2` : questId;
}

/** Kode awal satu fase langsung dari data quest. */
export function hybridPhaseInitialCode(
  quest: QuestDefinition,
  phase: HybridPhase,
): string {
  return phase === 2 ? (quest.hybridBotInitialCode ?? '') : quest.initialCode;
}

/* ------------------------------------------------------------------ */
/* Persistensi fase antar-kunjungan (PT2-F6)                           */
/* ------------------------------------------------------------------ */

/** Fase tersimpan sebuah quest dari progres: hanya 2 yang pernah dicatat. */
export function savedHybridPhase(
  progress: Pick<PersistedProgress, 'hybridPhaseByQuest'>,
  questId: string,
): HybridPhase {
  return progress.hybridPhaseByQuest?.[questId] === 2 ? 2 : 1;
}

/**
 * Rencana membuka quest HYBRID, diputuskan murni dari progres tersimpan:
 * - 'phase1'     — mulai biasa dari fase 1 (tidak ada catatan fase 2,
 *                  quest bukan HYBRID, atau quest sudah tuntas: catatan
 *                  fase dibersihkan saat penyelesaian, jadi ini juga
 *                  pertahanan terhadap save janggal).
 * - 'replay'     — catatan fase 2 ada DAN kode fase 1 tersimpan: putar
 *                  ulang kode fase 1 secara diam-diam di mesin yang baru
 *                  di-seed untuk membangun kembali keadaan tabel yang
 *                  sudah diperbaiki, lalu masuk fase 2.
 * - 'clear-stale'— catatan fase 2 ada tetapi kode fase 1 hilang: catatan
 *                  basi, hapus dan mulai dari fase 1 dengan jujur.
 */
export type HybridReopenPlan =
  | { kind: 'phase1' }
  | { kind: 'replay'; phase1Code: string }
  | { kind: 'clear-stale' };

export function planHybridReopen(args: {
  isHybrid: boolean;
  savedPhase: HybridPhase;
  phase1Code: string | undefined;
  alreadyCompleted: boolean;
}): HybridReopenPlan {
  if (!args.isHybrid || args.savedPhase !== 2 || args.alreadyCompleted) {
    return { kind: 'phase1' };
  }
  if (!args.phase1Code) return { kind: 'clear-stale' };
  return { kind: 'replay', phase1Code: args.phase1Code };
}

/**
 * Nasib sesi sesudah replay fase 1 dinilai: lulus → fase 2 (catatan fase
 * dipertahankan); gagal → kembali ke fase 1 dan catatan fase DIHAPUS
 * (pemain mengulang fase 1 dengan sadar, bukan diam-diam).
 */
export function resolveHybridReplay(assessment: {
  pass: boolean;
}): { phase: HybridPhase; clearSavedPhase: boolean } {
  return assessment.pass
    ? { phase: 2, clearSavedPhase: false }
    : { phase: 1, clearSavedPhase: true };
}

/** Kunci reaksi kegagalan penilaian keadaan akhir tabel. */
export type FinalTableReactionKey =
  | 'still_corrupt'
  | 'innocent_changed'
  | 'wrong_result';

export type FinalTableAssessment =
  | { pass: true; corruptRemaining: 0 }
  | { pass: false; reactionKey: FinalTableReactionKey; corruptRemaining: number };

/**
 * Nilai keadaan akhir tabel terhadap keadaan yang diharapkan.
 *
 * @param finalRows    seluruh baris tabel sumber SESUDAH run pemain.
 * @param expectedRows keadaan yang diharapkan persis (semua kolom).
 * @param corruptValue nilai status yang menandai baris rusak ('CORRUPT').
 * @param statusColumn nama kolom status (default 'status').
 * @param idColumn     nama kolom identitas baris untuk membedakan baris
 *                     sehat yang berubah dari baris yang hilang (default 'id').
 */
export function assessFinalTableState(
  finalRows: Record<string, unknown>[],
  expectedRows: Record<string, unknown>[],
  corruptValue = 'CORRUPT',
  statusColumn = 'status',
  idColumn = 'id',
): FinalTableAssessment {
  const corruptRemaining = finalRows.filter(
    (row) => String(row[statusColumn] ?? '').toUpperCase() === corruptValue,
  ).length;

  const columns = [
    ...new Set([
      ...expectedRows.flatMap((r) => Object.keys(r)),
      ...finalRows.flatMap((r) => Object.keys(r)),
    ]),
  ];
  const diff = ResultDiffChecker.check(
    { columns, rows: finalRows },
    expectedRows,
    { orderMatters: false },
  );
  if (diff.pass) return { pass: true, corruptRemaining: 0 };

  if (corruptRemaining > 0) {
    return { pass: false, reactionKey: 'still_corrupt', corruptRemaining };
  }
  // Tidak ada lagi yang rusak, tapi tabel belum sama dengan harapan:
  // bedakan "baris sehat ikut berubah / hilang / bertambah" (kesalahan
  // konsep yang harus diajari) dari sisa perbedaan bentuk lain.
  if (finalRows.length !== expectedRows.length) {
    return { pass: false, reactionKey: 'innocent_changed', corruptRemaining: 0 };
  }
  const finalById = new Map(
    finalRows.map((row) => [String(row[idColumn]), row] as const),
  );
  for (const expected of expectedRows) {
    const actual = finalById.get(String(expected[idColumn]));
    if (!actual) {
      return { pass: false, reactionKey: 'innocent_changed', corruptRemaining: 0 };
    }
    // Bandingkan SEMUA kolom, termasuk status: expected sudah memuat
    // status akhir yang sah (baris rusak = 'SYNCED'), jadi baris sehat
    // yang statusnya ikut berubah (PENDING/OFFLINE tertimpa) tertangkap
    // persis di sini.
    for (const key of Object.keys(expected)) {
      if (String(actual[key] ?? '') !== String(expected[key] ?? '')) {
        return { pass: false, reactionKey: 'innocent_changed', corruptRemaining: 0 };
      }
    }
  }
  return { pass: false, reactionKey: 'wrong_result', corruptRemaining: 0 };
}
