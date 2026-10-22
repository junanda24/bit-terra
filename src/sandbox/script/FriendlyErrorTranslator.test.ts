import { describe, expect, it } from 'vitest';
import { unknownFunctionError } from './FriendlyErrorTranslator';

// Daftar allowed yang realistis: modul Piko + modul gate yang SUNGGUHAN ada.
const ALLOWED = [
  'piko.boot',
  'piko.moveForward',
  'piko.turnLeft',
  'piko.turnRight',
  'piko.charge',
  'gate.open',
  'gate.close',
];

describe('unknownFunctionError — kolam saran hanya dari daftar allowed asli (F-10)', () => {
  it('modul khayalan piko.fly: daftar modul di saran hanya menyebut fungsi piko.* yang ada', () => {
    const err = unknownFunctionError('piko.fly', 3, ALLOWED);
    expect(err.message).toContain('piko.fly');
    // Tidak boleh ada campuran lintas objek di daftar "modul yang Piko punya".
    expect(err.suggestion).toContain('piko.boot');
    expect(err.suggestion).not.toContain('gate.');
  });

  it('tidak pernah menyarankan kombinasi karangan seperti gate.charge / gate.boot', () => {
    for (const name of ['piko.fly', 'gate.charge', 'gate.boot', 'piko.open']) {
      const err = unknownFunctionError(name, 1, ALLOWED);
      expect(err.suggestion ?? '').not.toContain('gate.charge');
      expect(err.suggestion ?? '').not.toContain('gate.boot');
      expect(err.suggestion ?? '').not.toContain('gate.moveForward');
    }
  });

  it('typo dekat tetap ditebak ke fungsi yang benar di objek yang sama', () => {
    const err = unknownFunctionError('piko.moveFoward', 2, ALLOWED);
    expect(err.suggestion).toContain('piko.moveForward');
  });

  it('fungsi gate yang salah ditebak dari kolam gate saja', () => {
    const err = unknownFunctionError('gate.opn', 1, ALLOWED);
    expect(err.suggestion).toContain('gate.open');
    expect(err.suggestion).not.toContain('piko.');
  });
});
