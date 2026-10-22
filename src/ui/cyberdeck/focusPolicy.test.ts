import { describe, expect, it } from 'vitest';
import {
  FOCUS_FAIL_COST,
  FOCUS_SUCCESS_REWARD,
  shouldDeductFocusOnFail,
} from './focusPolicy';
import type { LintError } from '../../shared/types';

const INITIAL = 'piko.___(3)\npiko.___()\n';
const EDITED = 'piko.boot()\npiko.moveForward(2)\npiko.charge()\n';
const LINT: LintError[] = [{ line: 1, message: 'Kolom tidak ditemukan' }];

describe('shouldDeductFocusOnFail (F-04/F-09)', () => {
  it('kerangka yang belum disentuh: RUN pertama selalu gratis', () => {
    expect(
      shouldDeductFocusOnFail({ code: INITIAL, initialCode: INITIAL, lintErrors: [] }),
    ).toBe(false);
    expect(
      shouldDeductFocusOnFail({ code: INITIAL, initialCode: INITIAL, lintErrors: LINT }),
    ).toBe(false);
  });

  it('kode berubah tapi linter sudah memperingatkan sebelum RUN: gratis', () => {
    expect(
      shouldDeductFocusOnFail({ code: EDITED, initialCode: INITIAL, lintErrors: LINT }),
    ).toBe(false);
  });

  it('kode berubah, linter bersih, verdict gagal: potong (kesalahan konsep sungguhan)', () => {
    expect(
      shouldDeductFocusOnFail({ code: EDITED, initialCode: INITIAL, lintErrors: [] }),
    ).toBe(true);
  });

  it('besaran potongan & hadiah sesuai desain keseimbangan', () => {
    expect(FOCUS_FAIL_COST).toBe(10);
    expect(FOCUS_SUCCESS_REWARD).toBe(20);
  });
});
