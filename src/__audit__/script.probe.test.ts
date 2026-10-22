// AUDIT PROBES — Bot Script sandbox (READ-ONLY audit; these probes document
// ACTUAL behavior. Tests asserting the SECURE expectation FAIL on purpose
// where a finding exists — the failure output IS the evidence.)
import { describe, it, expect } from 'vitest';
import { MockBot } from '../sandbox/script/BotApiBindings';
import { createBotApi } from '../sandbox/script/BotApiBindings';
import { runBotScript } from '../sandbox/script/StepInterpreter';
import { lintScript } from '../sandbox/script/ScriptLinter';
import { FriendlyError } from '../sandbox/script/FriendlyErrorTranslator';
import type { StepEvent } from '../shared/types';

const BASE_ALLOWED = [
  'piko.boot',
  'piko.moveForward',
  'piko.turnLeft',
  'piko.turnRight',
  'piko.charge',
  'gate.open',
  'gate.close',
];

interface RunOutcome {
  events: StepEvent[];
  error: unknown;
  errorName: string;
  friendly: boolean;
}

async function run(code: string, bot?: MockBot): Promise<{ bot: MockBot } & RunOutcome> {
  const b = bot ?? new MockBot();
  const events: StepEvent[] = [];
  let error: unknown = null;
  try {
    for await (const ev of runBotScript(code, b.registry)) events.push(ev);
  } catch (err) {
    error = err;
  }
  return {
    bot: b,
    events,
    error,
    errorName: (error as Error)?.constructor?.name ?? 'none',
    friendly: error instanceof FriendlyError,
  };
}

function lintVerdict(code: string): string {
  try {
    const errs = lintScript(code, BASE_ALLOWED);
    return errs.length === 0 ? 'PASS' : `FLAG(${errs.length}): ${errs[0].message}`;
  } catch (err) {
    return `THREW ${(err as Error)?.constructor?.name}: ${(err as Error)?.message?.slice(0, 60)}`;
  }
}

/* ============================ 1. ESCAPE ============================ */

describe('§1 ESCAPE', () => {
  it('E1 piko.constructor (read) — secure expectation: FriendlyError', async () => {
    const r = await run('let f = piko.constructor;');
    console.log('E1', r.errorName, r.friendly, (r.error as Error)?.message);
    expect(r.friendly).toBe(true);
  });

  it('E2 sensor.constructor (read) leaks a native', async () => {
    const bot = new MockBot();
    const events: StepEvent[] = [];
    let captured: unknown;
    // Capture the value by passing it as a bot arg through a wrapper registry.
    const reg = createBotApi(['piko.moveForward'], {
      functions: { 'piko.moveForward': (v) => { captured = v; } },
      objects: { sensor: bot.sensor },
    });
    for await (const ev of runBotScript('piko.moveForward(sensor.constructor);', reg)) events.push(ev);
    console.log('E2 sensor.constructor typeof/name:', typeof captured, (captured as Function)?.name);
    // Secure expectation: player code should never obtain the Object constructor.
    expect(typeof captured).not.toBe('function');
  });

  it('E3 sensor.__proto__ (read) leaks Object.prototype', async () => {
    let captured: unknown;
    const bot = new MockBot();
    const reg = createBotApi(['piko.moveForward'], {
      functions: { 'piko.moveForward': (v) => { captured = v; } },
      objects: { sensor: bot.sensor },
    });
    for await (const _ of runBotScript('piko.moveForward(sensor.__proto__);', reg)) { /* drain */ }
    console.log('E3 sensor.__proto__ === Object.prototype:', captured === Object.prototype);
    expect(captured === Object.prototype).toBe(false);
  });

  it('E4a PROTO POLLUTION via static path sensor.__proto__.X = v', async () => {
    const KEY = 'bitterraAuditPwn';
    try {
      const r = await run(`sensor.__proto__.${KEY} = 123;`);
      const polluted = ({} as Record<string, unknown>)[KEY];
      console.log('E4a runError:', r.errorName, '| ({}).key =', polluted);
      expect(polluted).toBeUndefined();
    } finally {
      delete (Object.prototype as Record<string, unknown>)[KEY];
    }
  });

  it('E4b PROTO POLLUTION via computed path sensor["__proto__"]["X"] = v', async () => {
    const KEY = 'bitterraAuditPwn2';
    try {
      const r = await run(`sensor['__proto__']['${KEY}'] = 7;`);
      const polluted = ({} as Record<string, unknown>)[KEY];
      console.log('E4b runError:', r.errorName, '| ({}).key =', polluted);
      expect(polluted).toBeUndefined();
    } finally {
      delete (Object.prototype as Record<string, unknown>)[KEY];
    }
  });

  it('E4c sensor.__proto__ = {…} only re-prototypes sensor itself (distinguish)', async () => {
    const bot = new MockBot();
    const r = await run('sensor.__proto__ = { ghost: 1 };', bot);
    const globalPolluted = ({} as Record<string, unknown>)['ghost'];
    const sensorProto = Object.getPrototypeOf(bot.sensor) as Record<string, unknown>;
    console.log('E4c err:', r.errorName, '| global ghost:', globalPolluted, '| sensor proto ghost:', sensorProto?.ghost);
    expect(globalPolluted).toBeUndefined();
  });

  it('E5a piko.boot.constructor reads the Function constructor', async () => {
    let captured: unknown;
    const reg = createBotApi(['piko.moveForward', 'piko.boot'], {
      functions: { 'piko.moveForward': (v) => { captured = v; }, 'piko.boot': () => undefined },
      objects: {},
    });
    for await (const _ of runBotScript('piko.moveForward(piko.boot.constructor);', reg)) { /* drain */ }
    console.log('E5a piko.boot.constructor === Function:', captured === Function, '| name:', (captured as Function)?.name);
    expect(captured === Function).toBe(false);
  });

  it('E5b FULL ESCAPE: computed-member indirection executes Function(...)()', async () => {
    const bot = new MockBot();
    const r = await run(
      "let box = [piko.boot.constructor];\nlet r = box[0]('return 6 * 7')();\npiko.moveForward(r);",
      bot,
    );
    const arg = bot.calls.find((c) => c.action === 'piko.moveForward')?.args?.[0];
    console.log('E5b err:', r.errorName, r.friendly, '| moveForward arg =', arg, '| bot.position.x =', bot.position.x);
    // Secure expectation: run must fail with FriendlyError and never produce 42.
    expect(r.friendly).toBe(true);
    expect(arg).not.toBe(42);
  });

  it('E5c FULL ESCAPE variant: Function("return this")() reaches globalThis', async () => {
    let captured: unknown;
    const reg = createBotApi(['piko.moveForward', 'piko.boot'], {
      functions: { 'piko.moveForward': (v) => { captured = v; }, 'piko.boot': () => undefined },
      objects: {},
    });
    let err: unknown = null;
    try {
      for await (const _ of runBotScript(
        "let box = [piko.boot.constructor];\npiko.moveForward(box[0]('return this')());",
        reg,
      )) { /* drain */ }
    } catch (e) { err = e; }
    console.log('E5c err:', (err as Error)?.constructor?.name, '| captured === globalThis:', captured === globalThis);
    expect(captured === globalThis).toBe(false);
  });

  it('E5d DIRECT member call piko.boot.constructor(...) is blocked (contrast)', async () => {
    const r = await run("let f = piko.boot.constructor('return 1');");
    console.log('E5d', r.errorName, r.friendly, (r.error as Error)?.message?.slice(0, 70));
    expect(r.friendly).toBe(true);
  });

  it("E6 piko['con'+'structor'] — secure expectation: FriendlyError", async () => {
    const r = await run("let f = piko['con' + 'structor'];");
    console.log('E6', r.errorName, r.friendly);
    expect(r.friendly).toBe(true);
  });

  it("E7 'abc'.constructor — secure expectation: FriendlyError (no native leak)", async () => {
    const r = await run("let f = 'abc'.constructor;");
    console.log('E7', r.errorName, r.friendly, (r.error as Error)?.message?.slice(0, 60));
    expect(r.friendly).toBe(true);
  });

  it('E8 [].constructor and Math.constructor reads leak natives', async () => {
    const got: unknown[] = [];
    const reg = createBotApi(['piko.moveForward'], {
      functions: { 'piko.moveForward': (v) => { got.push(v); } },
      objects: {},
    });
    for await (const _ of runBotScript('piko.moveForward([].constructor);\npiko.moveForward(Math.constructor);', reg)) { /* drain */ }
    console.log('E8 [].constructor === Array:', got[0] === Array, '| Math.constructor === Object:', got[1] === Object);
    expect(got[0] === Array).toBe(false);
    expect(got[1] === Object).toBe(false);
  });

  it('E9 this / globalThis / JSON identifiers', async () => {
    for (const [label, code] of [
      ['this', 'let t = this;'],
      ['globalThis', 'let g = globalThis;'],
      ['JSON', 'let j = JSON;'],
      ['Function-name', 'let f = Function;'],
      ['Object-name', 'let o = Object;'],
    ] as const) {
      const r = await run(code);
      console.log(`E9 ${label}:`, r.errorName, 'friendly:', r.friendly, '|', (r.error as Error)?.message?.slice(0, 55));
      expect(r.friendly).toBe(true);
    }
  });

  it('E10 assignment piko.__proto__ = {} and piko.moveForward = 5', async () => {
    const r1 = await run('piko.__proto__ = {};');
    const r2 = await run('piko.moveForward = 5;');
    console.log('E10a', r1.errorName, r1.friendly, '| E10b', r2.errorName, r2.friendly);
    expect(r1.friendly).toBe(true);
    expect(r2.friendly).toBe(true);
  });

  it('E11 sensor.constructor(...) direct call blocked', async () => {
    const r = await run("let x = sensor.constructor('a');");
    console.log('E11', r.errorName, r.friendly, (r.error as Error)?.message?.slice(0, 60));
    expect(r.friendly).toBe(true);
  });

  it('E12 registry gate: impl present in bindings but NOT in allowed stays uncallable', async () => {
    const bot = new MockBot();
    const reg = createBotApi(['piko.boot'], {
      functions: {
        'piko.boot': () => { bot.booted = true; },
        'gate.open': () => { bot.gate.isOpen = true; },
      },
      objects: { gate: bot.gate, sensor: bot.sensor },
    });
    let err: unknown = null;
    try {
      for await (const _ of runBotScript('gate.open();', reg)) { /* drain */ }
    } catch (e) { err = e; }
    console.log('E12 err:', (err as Error)?.constructor?.name, 'friendly:', err instanceof FriendlyError, '| gate.isOpen:', bot.gate.isOpen);
    expect(err instanceof FriendlyError).toBe(true);
    expect(bot.gate.isOpen).toBe(false);
  });

  it('E13 registry/object mutation persists across runs sharing one registry', async () => {
    const bot = new MockBot();
    const r1 = await run('sensor.soilMoisture = 5;', bot);
    const r2 = await run('piko.boot();', bot);
    console.log('E13 run1 err:', r1.errorName, '| sensor now:', bot.sensor.soilMoisture, '| shared calls total:', bot.calls.length);
    // Documents behavior; secure expectation would be per-run isolation of object writes.
    expect(bot.sensor.soilMoisture).toBe(30);
  });

  it('E14 wrapper .call via computed member: piko.boot["ca"+"ll"](null) must not execute boot', async () => {
    const bot = new MockBot();
    const r = await run("piko.boot['ca' + 'll'](null);", bot);
    console.log('E14 err:', r.errorName, r.friendly, '| booted:', bot.booted);
    expect(bot.booted).toBe(false);
  });
});

/* ============================ 2. FREEZE ============================ */

describe('§2 FREEZE', () => {
  it('F1 while(true){} — LoopGuard FriendlyError, fast', async () => {
    const t0 = Date.now();
    const r = await run('while (true) { }');
    console.log('F1', r.errorName, r.friendly, `${Date.now() - t0}ms`, (r.error as Error)?.message?.slice(0, 50));
    expect(r.friendly).toBe(true);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('F2 infinite loop whose counter lives in a called function — LoopGuard still counts iterations', async () => {
    const bot = new MockBot();
    const r = await run('let i = 0;\nfunction inc() { i = i + 1; }\nwhile (i < 3) { piko.boot(); }', bot);
    const boots = bot.calls.filter((c) => c.action === 'piko.boot').length;
    console.log('F2', r.errorName, r.friendly, '| boot calls before stop:', boots);
    expect(r.friendly).toBe(true);
    expect(boots).toBe(500);
  });

  it('F3 self-recursion hits the depth cap as FriendlyError (not raw RangeError)', async () => {
    const r = await run('function f() { f(); }\nf();');
    console.log('F3', r.errorName, r.friendly, (r.error as Error)?.message?.slice(0, 60));
    expect(r.friendly).toBe(true);
  });

  it('F4 mutual recursion hits the depth cap as FriendlyError', async () => {
    const r = await run('function f() { g(); }\nfunction g() { f(); }\nf();');
    console.log('F4', r.errorName, r.friendly);
    expect(r.friendly).toBe(true);
  });

  it('F5 recursion WITH a bot call per level: exactly 100 call events then FriendlyError', async () => {
    const bot = new MockBot();
    const r = await run('function f() { piko.boot(); f(); }\nf();', bot);
    const callEvents = r.events.filter((e) => e.kind === 'call').length;
    console.log('F5', r.errorName, r.friendly, '| call events:', callEvents, '| registry calls:', bot.calls.length);
    expect(r.friendly).toBe(true);
    expect(callEvents).toBe(100);
  });

  it('F6 STRING BOMB dodges LoopGuard: while(i<40){ s=s+s } — guard counts iterations, not work', async () => {
    const t0 = Date.now();
    const r = await run("let s = 'x';\nlet i = 0;\nwhile (i < 40) { s = s + s; i = i + 1; }");
    const ms = Date.now() - t0;
    console.log('F6', r.errorName, 'friendly:', r.friendly, `${ms}ms`, '| msg:', (r.error as Error)?.message?.slice(0, 60));
    // Secure expectation: a sandbox guard (not the JS engine) stops this.
    // If the only thing that stops it is a V8 RangeError wrapped generically,
    // the error will be FriendlyError but NOT the loopGuard message.
    expect((r.error as Error)?.message ?? '').toContain('Loop');
  });

  it('F7 EXPONENTIAL RECURSION dodges LoopGuard AND depth cap AND emits no step events (fib)', async () => {
    const code = 'function fib(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }\npiko.moveForward(fib(N));';
    const t0 = Date.now();
    const r26 = await run(code.replace('N', '26'));
    const ms26 = Date.now() - t0;
    const arg = r26.bot.calls.find((c) => c.action === 'piko.moveForward')?.args?.[0];
    console.log(`F7 fib(26): ${ms26}ms, events before done: ${r26.events.filter((e) => e.kind !== 'done').length}, callEvents: ${r26.events.filter((e) => e.kind === 'call').length}, arg=${arg}, err=${r26.errorName}`);
    console.log('F7 extrapolation: cost multiplies by ~2.6 per +2 n → fib(40) ≈ fib(26) × ~10^3, fib(50) ≈ × ~10^5 — no guard ever fires (no loop, depth ≤ n).');
    // Secure expectation: some total-work budget stops exponential recursion.
    expect(r26.errorName).not.toBe('none');
  }, 120000);

  it('F8 for-of over a 600-element literal trips LoopGuard at 501', async () => {
    const arr = Array.from({ length: 600 }, (_, i) => i).join(',');
    const r = await run(`for (const x of [${arr}]) { }`);
    console.log('F8', r.errorName, r.friendly);
    expect(r.friendly).toBe(true);
  });

  it('F9 deep binary chain 1+1+… (20000 terms): interpreter outcome', async () => {
    const code = `let x = ${'1' + '+1'.repeat(20000)};`;
    const t0 = Date.now();
    const r = await run(code);
    console.log('F9 interp:', r.errorName, 'friendly:', r.friendly, `${Date.now() - t0}ms`);
    expect(r.errorName === 'none' || r.friendly).toBe(true);
  }, 60000);

  it('F10 deep binary chain through the LINTER: raw RangeError must not escape lintScript', () => {
    const code = `let x = ${'1' + '+1'.repeat(20000)};`;
    let out: string;
    try {
      const errs = lintScript(code, BASE_ALLOWED);
      out = `returned ${errs.length} errors`;
    } catch (err) {
      out = `THREW ${(err as Error)?.constructor?.name}`;
    }
    console.log('F10 lint:', out);
    expect(out.startsWith('THREW RangeError')).toBe(false);
  }, 60000);

  it('F11 deeply nested parens (20000) in both entry points', async () => {
    const code = `${'('.repeat(20000)}1${')'.repeat(20000)};`;
    const lv = lintVerdict(code);
    const r = await run(code);
    console.log('F11 lint:', lv, '| interp:', r.errorName, 'friendly:', r.friendly);
    expect(r.friendly).toBe(true);
  }, 60000);
});

/* ================== 3. LINTER ↔ INTERPRETER CORPUS ================== */

interface CorpusCase {
  id: string;
  code: string;
  note: string;
}

// For every case we log BOTH verdicts. A case is a DISAGREEMENT when the
// linter PASSes but the interpreter rejects (or errors), or the linter
// FLAGs code the interpreter executes fine, or both "accept" but the
// runtime result is silently wrong.
const CORPUS: CorpusCase[] = [
  { id: 'L01', code: 'piko.fly();', note: 'control: unknown module — both must reject' },
  { id: 'L02', code: 'let f = (x) => x * 2;\npiko.moveForward(f(3));', note: 'expression-body arrow: result silently undefined?' },
  { id: 'L03', code: 'let f = (x) => { return x * 2; };\npiko.moveForward(f(3));', note: 'control: block-body arrow works' },
  { id: 'L04', code: 'let [a] = [3];\npiko.moveForward(a);', note: 'destructuring declaration' },
  { id: 'L05', code: 'piko.boot();\nclass A { }', note: 'class statement' },
  { id: 'L06', code: 'let v = sensor?.soilMoisture;', note: 'optional chaining read' },
  { id: 'L07', code: 'if (false) { piko.fly(); }\npiko.boot();', note: 'dead code unknown call — linter flags, interpreter never runs it (blocks RUN gate)' },
  { id: 'L08', code: 'function f(g) { return 1; }\ng();', note: "call to another function's parameter name" },
  { id: 'L09', code: '{ function h() { piko.boot(); } }\nh();', note: 'block-scoped function called outside its block' },
  { id: 'L10', code: 'let n = 5;\nn();', note: 'calling a number' },
  { id: 'L11', code: 'let piko = { boot: () => 0 };\npiko.boot();', note: 'shadowing the bot root name' },
  { id: 'L12', code: 'piko.moveForward(y);\nlet y = 3;', note: 'use before declare' },
  { id: 'L13', code: 'let x = x;', note: 'self-referencing initializer' },
  { id: 'L14', code: 'let d = new piko.boot();', note: 'new expression' },
  { id: 'L15', code: 'let x = 1;\nswitch (x) { case 1: piko.boot(); }', note: 'switch statement' },
  { id: 'L16', code: 'try { piko.boot(); } catch (e) { piko.charge(); }', note: 'try/catch' },
  { id: 'L17', code: 'luar: for (let i = 0; i < 1; i++) { break luar; }', note: 'labelled break' },
  { id: 'L18', code: 'piko.moveForward();', note: 'arity: no args — anything validate?' },
  { id: 'L19', code: "piko.moveForward('tiga');", note: 'arity/type: string arg' },
  { id: 'L20', code: 'let a = [3];\npiko.moveForward(...a);', note: 'control: spread call works' },
  { id: 'L21', code: 'delete sensor.soilMoisture;', note: 'delete operator' },
  { id: 'L22', code: 'let t = typeof globalThis;', note: 'typeof guard on unknown identifier' },
  { id: 'L23', code: 'let t = typeof piko;', note: 'typeof the registry root — says undefined though piko.boot works' },
  { id: 'L24', code: 'piko.boot();\n;', note: 'control: clean program' },
  { id: 'L25', code: 'function rusak( {', note: 'control: syntax error — both must reject identically' },
];

describe('§3 LINTER vs INTERPRETER corpus', () => {
  it('corpus: both verdicts logged per snippet', async () => {
    for (const c of CORPUS) {
      const lv = lintVerdict(c.code);
      const r = await run(c.code);
      const calls = r.bot.calls.map((cc) => `${cc.action}(${cc.args.map(String).join(',')})`).join(' ');
      const interp = r.error
        ? `${r.friendly ? 'FRIENDLY' : 'RAW'}-${r.errorName}: ${(r.error as Error).message.slice(0, 45)}`
        : `OK calls=[${calls}] booted=${r.bot.booted} pos=${r.bot.position.x} sensor=${r.bot.sensor.soilMoisture}`;
      console.log(`${c.id} | lint=${lv.startsWith('PASS') ? 'PASS' : lv} | interp=${interp} | ${c.note}`);
    }
    expect(true).toBe(true);
  });

  it('L02-detail: expression-body arrow result is the moveForward argument', async () => {
    const bot = new MockBot();
    const r = await run('let f = (x) => x * 2;\npiko.moveForward(f(3));', bot);
    const arg = bot.calls.find((c) => c.action === 'piko.moveForward')?.args?.[0];
    console.log('L02-detail arg =', arg, '(correct value would be 6); err =', r.errorName);
    expect(arg).toBe(6);
  });

  it('L11-detail: shadowed piko still triggers the REAL bot boot', async () => {
    const bot = new MockBot();
    const r = await run('let piko = { boot: () => 0 };\npiko.boot();', bot);
    console.log('L11-detail booted(real bot) =', bot.booted, '| err =', r.errorName);
    // Secure expectation: player's own object should shadow (or be rejected) —
    // silently executing the real bot action is a semantic hijack.
    expect(bot.booted).toBe(false);
  });
});

/* ====================== 4. STEP SEMANTICS ====================== */

describe('§4 STEP SEMANTICS', () => {
  it('S1 call event is yielded BEFORE the bot function executes', async () => {
    const bot = new MockBot();
    const it = runBotScript('piko.boot();', bot.registry);
    const first = await it.next();
    console.log('S1 first event:', JSON.stringify(first.value), '| booted at event time:', bot.booted);
    expect(first.value?.kind).toBe('call');
    expect(bot.booted).toBe(false);
    const second = await it.next();
    console.log('S1 second event:', JSON.stringify(second.value), '| booted after resume:', bot.booted);
    expect(bot.booted).toBe(true);
    await it.return(undefined);
  });

  it('S2 nested call inside argument list: exactly one call event per call, inner first', async () => {
    const bot = new MockBot();
    const r = await run('piko.moveForward(piko.charge());', bot);
    const callEvents = r.events.filter((e) => e.kind === 'call').map((e) => e.action);
    console.log('S2 call events:', JSON.stringify(callEvents), '| registry order:', bot.calls.map((c) => c.action).join(','));
    expect(callEvents).toEqual(['piko.charge', 'piko.moveForward']);
  });

  it('S3 bot call inside if-condition and inside branch (no braces)', async () => {
    const bot = new MockBot({ soilMoisture: 30 });
    const r = await run('if (piko.boot()) { gate.open(); } else gate.close();', bot);
    console.log('S3 events:', JSON.stringify(r.events), '| gate open:', bot.gate.isOpen, '| err:', r.errorName);
    expect(r.events.filter((e) => e.kind === 'call').map((e) => e.action)).toContain('piko.boot');
  });

  it('S4 line numbers: comments/blank lines before, call spanning lines 4-6', async () => {
    const code = '// komentar\n\nlet langkah = 3;\npiko.moveForward(\n  langkah\n);';
    const r = await run(code);
    const callEv = r.events.find((e) => e.kind === 'call');
    const assignEv = r.events.find((e) => e.kind === 'assign');
    console.log('S4 call event line:', callEv?.line, '(call starts line 4) | assign line:', assignEv?.line, '(decl line 3)');
    expect(callEv?.line).toBe(4);
    expect(assignEv?.line).toBe(3);
  });

  it('S5 else-if chain: branch + call event sequence', async () => {
    const bot = new MockBot({ soilMoisture: 85 });
    const r = await run(
      'if (sensor.soilMoisture < 40) { gate.open(); } else if (sensor.soilMoisture < 90) { piko.boot(); } else { piko.charge(); }',
      bot,
    );
    console.log('S5 events:', JSON.stringify(r.events.map((e) => `${e.kind}${e.action ? ':' + e.action : ''}@${e.line}`)), '| booted:', bot.booted);
    expect(bot.booted).toBe(true);
    expect(r.events.filter((e) => e.kind === 'branch').length).toBeGreaterThanOrEqual(1);
  });

  it('S6 let r = piko.boot(); yields call BEFORE assign', async () => {
    const r = await run('let r = piko.boot();');
    const kinds = r.events.map((e) => e.kind);
    console.log('S6 kinds:', JSON.stringify(kinds));
    expect(kinds.indexOf('call')).toBeLessThan(kinds.indexOf('assign'));
  });

  it('S7 player WRITES sensor state directly — no call event, live object mutated', async () => {
    const bot = new MockBot();
    const r = await run('sensor.soilMoisture = 5;', bot);
    console.log('S7 sensor after:', bot.sensor.soilMoisture, '| events:', JSON.stringify(r.events), '| calls:', bot.calls.length);
    // BotApiBindings documents objects as data the player can READ ("bisa dibaca").
    expect(r.events.filter((e) => e.kind === 'call')).toHaveLength(0);
    expect(bot.sensor.soilMoisture).toBe(30);
  });

  it('S8 player flips gate.isOpen directly — world state changes with ZERO call records', async () => {
    const bot = new MockBot();
    const r = await run('gate.isOpen = true;', bot);
    console.log('S8 gate.isOpen:', bot.gate.isOpen, '| registry calls:', bot.calls.length, '| events:', JSON.stringify(r.events));
    expect(bot.gate.isOpen).toBe(false);
    expect(bot.calls).toHaveLength(0);
  });

  it('S9 while-loop events carry the loop line each iteration', async () => {
    const r = await run('let i = 0;\nwhile (i < 3) {\n  i = i + 1;\n}');
    const loopLines = r.events.filter((e) => e.kind === 'loop').map((e) => e.line);
    console.log('S9 loop event lines:', JSON.stringify(loopLines));
    expect(loopLines).toEqual([2, 2, 2]);
  });

  it('S10 function returning the bot object, then mutating through the alias', async () => {
    const bot = new MockBot();
    const r = await run('function g() { return sensor; }\nlet s = g();\ns.soilMoisture = 99;', bot);
    console.log('S10 sensor after alias write:', bot.sensor.soilMoisture, '| err:', r.errorName);
    expect(bot.sensor.soilMoisture).toBe(30);
  });
});

/* ======================= 5. ERROR QUALITY ======================= */

describe('§5 ERROR QUALITY sweep', () => {
  const FAILING: Array<[string, string]> = [
    ['unknown-module', 'piko.fly();'],
    ['unknown-var', 'piko.moveForward(y);'],
    ['call-number', 'let n = 5;\nn();'],
    ['loop-guard', 'while (true) { }'],
    ['recursion', 'function f() { f(); }\nf();'],
    ['member-of-null', 'let o = null;\no.x;'],
    ['not-iterable', 'for (const x of 42) { }'],
    ['bad-unary-target', 'let s = "a";\ns++;'],
    ['return-outside-fn', 'return 1;'],
    ['break-outside-loop', 'break;'],
    ['unsupported-stmt', 'switch (1) { case 1: break; }'],
    ['syntax', 'piko.boot(;'],
  ];
  it('every failure surfaces as FriendlyError with Indonesian text, never raw engine errors', async () => {
    for (const [label, code] of FAILING) {
      const r = await run(code);
      const msg = (r.error as Error)?.message ?? '';
      const rawLeaks = /cannot read|is not a function|maximum call stack|rangeerror|unexpected token|is not defined/i.test(msg);
      console.log(`EQ ${label}: ${r.errorName} friendly=${r.friendly} rawLeak=${rawLeaks} | ${msg.slice(0, 60)}`);
      expect(r.error).not.toBeNull();
      expect(r.friendly).toBe(true);
      expect(rawLeaks).toBe(false);
    }
  });
});
