import { describe, expect, it } from 'vitest';
import type { StepEvent } from '../../shared/types';
import { MockBot } from './BotApiBindings';
import { FriendlyError } from './FriendlyErrorTranslator';
import { runBotScript } from './StepInterpreter';

async function collect(code: string, bot: MockBot): Promise<StepEvent[]> {
  const events: StepEvent[] = [];
  for await (const ev of runBotScript(code, bot.registry)) events.push(ev);
  return events;
}

describe('StepInterpreter — panggilan berurutan', () => {
  it('menghasilkan StepEvent call berurutan dengan baris & args yang benar, diakhiri done', async () => {
    const bot = new MockBot();
    const code = ['piko.boot();', 'piko.moveForward(2);', 'piko.charge();'].join('\n');
    const events = await collect(code, bot);

    const calls = events.filter((e) => e.kind === 'call');
    expect(calls.map((e) => e.action)).toEqual(['piko.boot', 'piko.moveForward', 'piko.charge']);
    expect(calls.map((e) => e.line)).toEqual([1, 2, 3]);
    expect(calls[1].args).toEqual([2]);
    expect(events[events.length - 1].kind).toBe('done');

    // Registry mencatat panggilan dengan urutan yang sama.
    expect(bot.calls.map((c) => c.action)).toEqual(['piko.boot', 'piko.moveForward', 'piko.charge']);
    expect(bot.booted).toBe(true);
    expect(bot.position.x).toBe(2);
    expect(bot.chargeLevel).toBe(100);
  });

  it('Q1 "Bangun, Piko!": boot -> moveForward(3) -> charge berjalan penuh', async () => {
    const bot = new MockBot();
    const code = ['piko.boot();', 'piko.moveForward(3);', 'piko.charge();'].join('\n');
    const events = await collect(code, bot);
    expect(events[events.length - 1].kind).toBe('done');
    expect(bot.booted).toBe(true);
    expect(bot.position).toEqual({ x: 3, y: 0 });
    expect(bot.chargeLevel).toBe(100);
    expect(bot.calls).toHaveLength(3);
  });

  it('variabel, assignment, dan ekspresi hitung bekerja', async () => {
    const bot = new MockBot();
    const code = ['let langkah = 1;', 'langkah = langkah + 2;', 'piko.moveForward(langkah);'].join('\n');
    const events = await collect(code, bot);
    expect(events.some((e) => e.kind === 'assign')).toBe(true);
    expect(bot.position.x).toBe(3);
  });

  it('template literal sederhana bekerja', async () => {
    const bot = new MockBot();
    const code = ['let n = 2;', 'let label = `maju ${n + 1}`;', 'if (label === "maju 3") { piko.moveForward(1); }'].join('\n');
    await collect(code, bot);
    expect(bot.position.x).toBe(1);
  });
});

describe('StepInterpreter — percabangan & loop', () => {
  it('if memilih cabang dari nilai sensor (tanah kering -> pintu dibuka)', async () => {
    const bot = new MockBot({ soilMoisture: 30 });
    const code = [
      'if (sensor.soilMoisture < 40) {',
      '  gate.open();',
      '} else {',
      '  gate.close();',
      '}',
    ].join('\n');
    const events = await collect(code, bot);
    expect(events.some((e) => e.kind === 'branch')).toBe(true);
    expect(bot.gate.isOpen).toBe(true);
    expect(bot.calls.map((c) => c.action)).toEqual(['gate.open']);
  });

  it('else dipilih saat sensor menunjukkan tanah basah', async () => {
    const bot = new MockBot({ soilMoisture: 85 });
    const code = 'if (sensor.soilMoisture < 40) { gate.open(); } else { gate.close(); }';
    await collect(code, bot);
    expect(bot.gate.isOpen).toBe(false);
    expect(bot.calls.map((c) => c.action)).toEqual(['gate.close']);
  });

  it('for loop beriterasi sesuai hitungan', async () => {
    const bot = new MockBot();
    const code = 'for (let i = 0; i < 3; i++) { piko.moveForward(1); }';
    const events = await collect(code, bot);
    expect(bot.position.x).toBe(3);
    expect(events.filter((e) => e.kind === 'loop')).toHaveLength(3);
    expect(events.filter((e) => e.kind === 'call')).toHaveLength(3);
  });

  it('for...of mengulang isi daftar', async () => {
    const bot = new MockBot();
    const code = ['let daftar = [1, 2];', 'for (let n of daftar) { piko.moveForward(n); }'].join('\n');
    await collect(code, bot);
    expect(bot.position.x).toBe(3);
  });

  it('while(true) menabrak LoopGuard dengan pesan ramah dan TIDAK hang', async () => {
    const bot = new MockBot();
    const code = ['let aman = true;', 'while (true) {', '  piko.moveForward(1);', '}'].join('\n');
    const started = Date.now();
    await expect(collect(code, bot)).rejects.toBeInstanceOf(FriendlyError);
    await expect(collect(code, new MockBot())).rejects.toMatchObject({
      message: expect.stringContaining('tidak berhenti'),
    });
    expect(Date.now() - started).toBeLessThan(5000);
    // Tepat 500 iterasi yang sempat jalan sebelum guard menahan.
    expect(bot.calls).toHaveLength(500);
  });
});

describe('StepInterpreter — fungsi & error ramah', () => {
  it('fungsi buatan pemain + return bekerja', async () => {
    const bot = new MockBot();
    const code = [
      'function majuDanLapor() {',
      '  piko.moveForward(2);',
      '  return 7;',
      '}',
      'let hasil = majuDanLapor();',
      'piko.moveForward(hasil);',
    ].join('\n');
    await collect(code, bot);
    expect(bot.position.x).toBe(9);
  });

  it('fungsi tak dikenal piko.fly() -> FriendlyError bahasa Indonesia, bukan stack trace', async () => {
    const bot = new MockBot();
    let caught: unknown;
    try {
      await collect('piko.fly();', bot);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(FriendlyError);
    const fe = caught as FriendlyError;
    expect(fe.line).toBe(1);
    expect(fe.message).toContain('belum punya modul');
    expect(fe.message).toContain('piko.fly');
    expect(fe.message).not.toMatch(/at\s+\w+\s+\(/); // bukan stack trace
    expect(bot.calls).toHaveLength(0);
  });

  it('error sintaks diterjemahkan ramah dengan nomor baris', async () => {
    const bot = new MockBot();
    await expect(collect('piko.boot();\npiko.moveForward(;', bot)).rejects.toMatchObject({
      line: 2,
      message: expect.stringContaining('bingung membaca baris 2'),
    });
  });
});
