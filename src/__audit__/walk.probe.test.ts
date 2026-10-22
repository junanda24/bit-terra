// AUDIT PROBE (supplement) — linter walk() recursion window.
import { it } from 'vitest';
import { lintScript } from '../sandbox/script/ScriptLinter';

const ALLOWED = ['piko.boot', 'piko.moveForward', 'piko.charge', 'gate.open', 'gate.close'];

it('W1 nested array literals of increasing depth through lintScript', () => {
  for (const depth of [1000, 3000, 6000, 10000]) {
    const code = `let x = ${'['.repeat(depth)}1${']'.repeat(depth)};`;
    let out: string;
    try {
      const errs = lintScript(code, ALLOWED);
      out = `returned ${errs.length} err`;
    } catch (err) {
      out = `THREW ${(err as Error)?.constructor?.name}`;
    }
    console.log(`W1 depth=${depth}: ${out}`);
  }
});

it('W2 nested call-arg/member chains through lintScript', () => {
  for (const depth of [1000, 3000, 6000]) {
    const code = `let x = ${'f('.repeat(depth)}1${')'.repeat(depth)};`;
    let out: string;
    try {
      const errs = lintScript(code, ALLOWED);
      out = `returned ${errs.length} err`;
    } catch (err) {
      out = `THREW ${(err as Error)?.constructor?.name}`;
    }
    console.log(`W2 depth=${depth}: ${out}`);
  }
});
