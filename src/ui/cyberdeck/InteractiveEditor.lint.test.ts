// Regression: live crash 2026-10-22 (user report 10:12 WIB) —
// "Ranges must be added sorted by `from` position and `startSide`" thrown by
// RangeSetBuilder when the linter reported TWO errors on the SAME line:
// buildLintValue added line+mark ranges per error, so the second error's
// line decoration jumped BACKWARD past the first error's mark.
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { buildLintValue } from './InteractiveEditor';
import type { LintError } from '../../shared/types';

const DOC = [
  'SELECT nama_domba, zona_terakhir FROM livestock_logs',
  "WHERE status = 'LOST' AND pemilik = 'saya'",
  'piko.boot();',
].join('\n');

function state(): EditorState {
  return EditorState.create({ doc: DOC });
}

function err(line: number, column: number, message = 'x'): LintError {
  return { line, column, message };
}

function rangeFroms(state: EditorState, errors: LintError[]): number[] {
  const { deco } = buildLintValue(state, errors);
  const froms: number[] = [];
  const cursor = deco.iter();
  while (cursor.value) {
    froms.push(cursor.from);
    cursor.next();
  }
  return froms;
}

describe('buildLintValue — urutan RangeSet (regresi crash 2026-10-22)', () => {
  it('dua error sebaris, kolom menurun: tidak melempar', () => {
    const s = state();
    expect(() => buildLintValue(s, [err(1, 40), err(1, 8)])).not.toThrow();
  });

  it('dua error sebaris, kolom menaik: tidak melempar', () => {
    const s = state();
    expect(() => buildLintValue(s, [err(1, 8), err(1, 40)])).not.toThrow();
  });

  it('error tak terurut antar baris: hasil tetap terurut menaik', () => {
    const s = state();
    const froms = rangeFroms(s, [err(2, 30), err(1, 8), err(2, 6), err(1, 40)]);
    const sorted = [...froms].sort((a, b) => a - b);
    expect(froms).toEqual(sorted);
  });

  it('dekorasi garis dipasang sekali per baris bermasalah', () => {
    const s = state();
    const { deco, markers } = buildLintValue(s, [err(1, 40), err(1, 8), err(2, 6)]);
    // 2 garis bermasalah -> 2 dekorasi garis; total range = 2 line + 3 mark.
    let total = 0;
    const cursor = deco.iter();
    while (cursor.value) {
      total++;
      cursor.next();
    }
    expect(total).toBe(5);
    let markerCount = 0;
    const mc = markers.iter();
    while (mc.value) {
      markerCount++;
      mc.next();
    }
    expect(markerCount).toBe(2);
  });

  it('error di kolom 1 (from == awal baris) tetap aman', () => {
    const s = state();
    expect(() => buildLintValue(s, [err(3, 1), err(1, 1)])).not.toThrow();
  });
});
