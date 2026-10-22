import type { LintError } from '../../shared/types';

/**
 * Kebijakan Focus yang memaafkan (temuan playtest F-04 + F-09): pemain tidak
 * boleh membayar fokus untuk kegagalan yang SUDAH diketahui game sebelum
 * tuas RUN ditarik. Potongan hanya adil untuk kode yang (a) sudah diubah
 * dari kerangka awal quest DAN (b) bersih dari error linter saat RUN
 * ditekan, tetapi verdict-nya tetap gagal — itu kesalahan konsep sungguhan.
 * Menyelesaikan quest mengembalikan fokus (istirahat yang terbayar lunas).
 */

export const FOCUS_FAIL_COST = 10;
export const FOCUS_SUCCESS_REWARD = 20;

export interface FocusDecisionInput {
  /** Kode persis seperti saat RUN ditekan. */
  code: string;
  /** Kerangka awal quest (quest.initialCode). */
  initialCode: string;
  /** Error linter yang sudah tampil sebelum RUN (snapshot saat RUN). */
  lintErrors: LintError[];
}

/**
 * true = gagal ini boleh memotong fokus. false = gratis:
 * - kode masih persis kerangka awal (tarikan rasa penasaran, F-09), atau
 * - linter sudah memperingatkan sebelum RUN (hukuman ganda bila dipotong, F-04).
 */
export function shouldDeductFocusOnFail(input: FocusDecisionInput): boolean {
  if (input.code === input.initialCode) return false;
  if (input.lintErrors.length > 0) return false;
  return true;
}
