import { describe, expect, it } from 'vitest';
import { lintScript } from './ScriptLinter';

const ALLOWED = ['piko.boot', 'piko.moveForward', 'piko.charge', 'gate.open', 'gate.close'];

describe('ScriptLinter', () => {
  it('kode bersih -> tanpa error', () => {
    const code = ['piko.boot();', 'piko.moveForward(3);', 'piko.charge();'].join('\n');
    expect(lintScript(code, ALLOWED)).toEqual([]);
  });

  it('fungsi tak dikenal -> satu LintError ramah di baris yang benar', () => {
    const errors = lintScript('piko.boot();\npiko.fly();', ALLOWED);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
    expect(errors[0].message).toContain('belum punya modul');
    expect(errors[0].message).toContain('piko.fly');
  });

  it('error sintaks -> LintError ramah, bukan pesan acorn mentah', () => {
    const errors = lintScript('piko.moveForward(;', ALLOWED);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].message).toContain('Piko bingung membaca baris 1');
  });

  it('fungsi buatan pemain tidak ditandai sebagai error', () => {
    const code = [
      'function sapa() { piko.boot(); }',
      'sapa();',
      'for (let i = 0; i < 2; i++) { piko.moveForward(1); }',
    ].join('\n');
    expect(lintScript(code, ALLOWED)).toEqual([]);
  });
});

describe('blanko template ___ (audit layout F)', () => {
  it('piko.___ menghasilkan error berkode blank TANPA daftar modul', () => {
    const errors = lintScript('piko.___();', ALLOWED);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('blank');
    expect(errors[0].message).toContain('bagian kosong');
    expect(errors[0].suggestion ?? '').not.toContain('Modul yang Piko punya');
  });

  it('dua blanko di dua baris: dua error blank terpisah (UI yang menggabungkan)', () => {
    const errors = lintScript('piko.___();\npiko.boot();\npiko.___(3);', ALLOWED);
    expect(errors.map((e) => [e.line, e.code])).toEqual([
      [1, 'blank'],
      [3, 'blank'],
    ]);
  });

  it('modul tak dikenal biasa TIDAK ikut jadi blank', () => {
    const errors = lintScript('piko.fly();', ALLOWED);
    expect(errors[0].code).toBeUndefined();
  });
});
