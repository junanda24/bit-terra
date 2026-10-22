// SandboxHardening — regresi untuk temuan audit Fase 1 §Script
// (docs/AUDIT-FASE1-2026-10-22.md): SCR-H1/H2/H3, SCR-M2/M3/M4 (interpreter)
// dan SCR-M5/M6/M7 (linter). Setiap test menamai temuannya.

import { describe, expect, it } from 'vitest';
import { MockBot, createBotApi } from './BotApiBindings';
import { FriendlyError } from './FriendlyErrorTranslator';
import { lintScript } from './ScriptLinter';
import { MAX_TOTAL_STEPS, runBotScript } from './StepInterpreter';

const ALLOWED = ['piko.boot', 'piko.moveForward', 'piko.charge', 'gate.open', 'gate.close'];

async function run(code: string, bot = new MockBot()) {
  const events: unknown[] = [];
  let error: unknown = null;
  try {
    for await (const ev of runBotScript(code, bot.registry)) events.push(ev);
  } catch (err) {
    error = err;
  }
  return { bot, events, error };
}

/* ------------------------------- SCR-H1 ---------------------------------- */

describe('SCR-H1: sandbox escape ditutup', () => {
  it('konstruktor yang dicapai lewat computed member tidak bisa dipanggil', async () => {
    const { error } = await run("let k = [piko.boot.constructor][0];\nk('return 42')();");
    expect(error).toBeInstanceOf(FriendlyError);
  });

  it('membaca .constructor / .__proto__ tidak membocorkan host', async () => {
    const captured: Record<string, unknown> = {};
    const registry = createBotApi(['cap'], {
      functions: {
        cap: (v: unknown) => {
          captured.value = v;
        },
      },
      objects: { sensor: { soilMoisture: 30 } },
    });
    const code = 'cap(sensor.constructor);\ncap(sensor.__proto__);';
    let error: unknown = null;
    try {
      for await (const ev of runBotScript(code, registry)) void ev;
    } catch (err) {
      error = err;
    }
    expect(error).toBeNull();
    expect(captured.value).toBeUndefined();
    expect(registry.calls).toHaveLength(2);
  });

  it('fungsi registry yang disimpan di variabel tetap bisa dipanggil (alias sah)', async () => {
    const { bot, error } = await run('let b = piko.boot;\nb();');
    expect(error).toBeNull();
    expect(bot.booted).toBe(true);
  });
});

/* ------------------------------- SCR-H2 ---------------------------------- */

describe('SCR-H2: polusi prototipe ditolak', () => {
  it('sensor.__proto__.x = 1 -> FriendlyError dan Object.prototype bersih', async () => {
    const { error } = await run('sensor.__proto__.polluted_h2 = 1;');
    expect(error).toBeInstanceOf(FriendlyError);
    expect(({} as Record<string, unknown>).polluted_h2).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted_h2).toBeUndefined();
  });

  it('jalur computed sensor["__proto__"]["x"] juga ditolak', async () => {
    const { error } = await run('sensor["__proto__"]["polluted_h2b"] = 1;');
    expect(error).toBeInstanceOf(FriendlyError);
    expect(({} as Record<string, unknown>).polluted_h2b).toBeUndefined();
  });

  it('literal objek { "__proto__": ... } tidak mengganti prototipe siapa pun', async () => {
    const protoBefore = Object.getPrototypeOf({});
    const { error } = await run('let o = { "__proto__": 5 };\npiko.moveForward(1);');
    // Pembuatan objeknya sendiri aman (properti data via defineProperty);
    // membaca balik kuncinya memang terlarang -> undefined, bukan host.
    expect(error).toBeNull();
    expect(Object.getPrototypeOf({})).toBe(protoBefore);
    expect((Object.prototype as Record<string, unknown>).polluted_h2).toBeUndefined();
  });
});

/* ------------------------------- SCR-H3 ---------------------------------- */

describe('SCR-H3: anggaran langkah total', () => {
  it('MAX_TOTAL_STEPS terdokumentasi dan masuk akal', () => {
    expect(MAX_TOTAL_STEPS).toBe(25_000);
  });

  it('fib(24) mati oleh anggaran langkah (bukan membeku)', async () => {
    const code =
      'function fib(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }\npiko.moveForward(fib(24));';
    const start = Date.now();
    const { error } = await run(code);
    const elapsed = Date.now() - start;
    expect(error).toBeInstanceOf(FriendlyError);
    expect((error as Error).message).toContain('kelelahan');
    expect(elapsed).toBeLessThan(10_000);
  }, 30_000);

  it('loop 500 iterasi dengan panggilan bot lolos nyaman', async () => {
    const code = 'let i = 0;\nwhile (i < 500) { piko.moveForward(0); i = i + 1; }';
    const { bot, error } = await run(code);
    expect(error).toBeNull();
    expect(bot.calls.filter((c) => c.action === 'piko.moveForward')).toHaveLength(500);
  });

  it('bom string dihentikan penjaga sandbox', async () => {
    const { error } = await run("let s = 'ab';\nlet i = 0;\nwhile (i < 40) { s = s + s; i = i + 1; }");
    expect(error).toBeInstanceOf(FriendlyError);
  });
});

/* ------------------------------- SCR-M2 ---------------------------------- */

describe('SCR-M2: data registry hanya-baca', () => {
  it('sensor.soilMoisture = 5 -> FriendlyError, nilai tidak berubah', async () => {
    const { bot, error } = await run('sensor.soilMoisture = 5;');
    expect(error).toBeInstanceOf(FriendlyError);
    expect((error as Error).message).toContain('hanya bisa dibaca');
    expect(bot.sensor.soilMoisture).toBe(30);
  });

  it('gate.isOpen = true -> FriendlyError; gate.open() tetap satu-satunya jalan', async () => {
    const bad = await run('gate.isOpen = true;');
    expect(bad.error).toBeInstanceOf(FriendlyError);
    expect(bad.bot.gate.isOpen).toBe(false);
    const good = await run('gate.open();');
    expect(good.error).toBeNull();
    expect(good.bot.gate.isOpen).toBe(true);
  });

  it('menulis lewat alias hasil fungsi tetap ditolak', async () => {
    const code = 'function ambil() { return sensor; }\nlet s = ambil();\ns.soilMoisture = 5;';
    const { bot, error } = await run(code);
    expect(error).toBeInstanceOf(FriendlyError);
    expect(bot.sensor.soilMoisture).toBe(30);
  });
});

/* ---------------------------- SCR-M3 & M4 -------------------------------- */

describe('SCR-M3/M4: semantik fungsi & shadowing', () => {
  it('arrow berbadan ekspresi mengembalikan nilainya', async () => {
    const { bot, error } = await run('let f = (x) => x * 2;\npiko.moveForward(f(3));');
    expect(error).toBeNull();
    expect(bot.calls.find((c) => c.action === 'piko.moveForward')?.args[0]).toBe(6);
  });

  it('variabel pemain bernama piko menimpa registry', async () => {
    const { bot, error } = await run('let piko = { boot: () => 0 };\npiko.boot();');
    expect(error).toBeNull();
    expect(bot.booted).toBe(false);
  });
});

/* ------------------------- linter: SCR-M5/M6/M7 --------------------------- */

describe('SCR-M5: linter sadar scope', () => {
  it("memanggil nama parameter fungsi LAIN ditandai (dulu lolos)", () => {
    const errors = lintScript('function f(g) { return 1; }\ng();', ALLOWED);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fungsi di dalam blok tidak bocor keluar blok', () => {
    const errors = lintScript('{ function h() { piko.boot(); } }\nh();', ALLOWED);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('parameter fungsi sendiri tetap sah dipanggil', () => {
    const errors = lintScript('function f(g) { g(); }\nlet cb = () => 1;\nf(cb);', ALLOWED);
    expect(errors).toEqual([]);
  });
});

describe('SCR-M6: linter menandai konstruk yang ditolak interpreter', () => {
  const cases: Array<[string, string]> = [
    ['destructuring', 'let [a] = [3];\npiko.moveForward(a);'],
    ['class', 'piko.boot();\nclass A { }'],
    ['optional chaining', 'let v = sensor?.soilMoisture;'],
    ['new', 'let d = new piko.boot();'],
    ['switch', 'let x = 1;\nswitch (x) { case 1: piko.boot(); }'],
    ['try/catch', 'try { piko.boot(); } catch (e) { piko.charge(); }'],
    ['label', 'luar: for (let i = 0; i < 1; i++) { break luar; }'],
    ['delete', 'delete sensor.soilMoisture;'],
    ['use-before-declare', 'piko.moveForward(y);\nlet y = 3;'],
    ['inisialisasi diri', 'let x = x;'],
    ['memanggil angka', 'let n = 5;\nn();'],
  ];
  for (const [name, code] of cases) {
    it(name, () => {
      expect(lintScript(code, ALLOWED).length).toBeGreaterThan(0);
    });
  }
});

describe('SCR-M7: cabang mati statis tidak ditandai', () => {
  it('if (false) { piko.fly(); } lolos', () => {
    expect(lintScript('if (false) { piko.fly(); }\npiko.boot();', ALLOWED)).toEqual([]);
  });

  it('while (false) { piko.fly(); } lolos', () => {
    expect(lintScript('while (false) { piko.fly(); }\npiko.boot();', ALLOWED)).toEqual([]);
  });

  it('panggilan sesudah return di fungsi yang sama lolos', () => {
    expect(lintScript('function f() { return 1; piko.fly(); }\nf();', ALLOWED)).toEqual([]);
  });
});

describe('linter: penulisan data registry & kontrol bersih', () => {
  it('gate.isOpen = true ditandai hanya-baca', () => {
    const errors = lintScript('gate.isOpen = true;', ALLOWED);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('hanya bisa dibaca');
  });

  it('program sah Fase 1 tetap bersih', () => {
    const code = [
      'piko.boot();',
      'let langkah = 3;',
      'for (let i = 0; i < langkah; i++) { piko.moveForward(1); }',
      'if (sensor.soilMoisture < 40) { gate.open(); } else { gate.close(); }',
      'piko.charge();',
    ].join('\n');
    expect(lintScript(code, ALLOWED)).toEqual([]);
  });
});
