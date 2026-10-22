import { describe, expect, it } from 'vitest';
import {
  createBotStageState,
  resolveScenarioFailKey,
  type BotStageState,
} from './botStageLogic';
import {
  runBotHeadless,
  runBotScenariosHeadless,
} from './botScenarioRunner';
import { allowedBotFunctions } from '../cyberdeck/CyberDeckScreen';
import { quest03PintuAir } from '../../content/quests/quest_03_pintu_air';

/**
 * PT2-F3: di jalur skenario, kunci tertulis skenario (failReactionKey)
 * tidak boleh menelan penyebab pose yang lebih presisi. Urutan dahulukan:
 * disiplin boot (wrong_order) → tabrakan sungguhan → kunci skenario →
 * kunci turunan. Tes unit memakai keadaan panggung rakitan; tes integrasi
 * menjalankan skrip sungguhan lewat interpreter asli melawan Q3.
 */
const setup = quest03PintuAir.botWorldSetup!;
const [dry, wet] = quest03PintuAir.botScenarios!;
const allowed = allowedBotFunctions(quest03PintuAir);

function state(patch: Partial<BotStageState>): BotStageState {
  return { ...createBotStageState(setup, [0, 2]), ...patch };
}

describe('resolveScenarioFailKey — urutan dahulukan (unit)', () => {
  it('tidak pernah boot: wrong_order, BUKAN gate_still_closed', () => {
    expect(resolveScenarioFailKey(state({ awake: false }), dry)).toBe('wrong_order');
  });

  it('beraksi selagi tertidur lalu boot belakangan: tetap wrong_order', () => {
    expect(
      resolveScenarioFailKey(state({ awake: true, actedWhileAsleep: true }), dry),
    ).toBe('wrong_order');
  });

  it('tabrak batas grid: out_of_bounds mengalahkan kunci skenario', () => {
    expect(
      resolveScenarioFailKey(state({ awake: true, crashed: true, crashKind: 'bounds' }), dry),
    ).toBe('out_of_bounds');
  });

  it('tabrak rintangan: hit_obstacle mengalahkan kunci skenario', () => {
    expect(
      resolveScenarioFailKey(state({ awake: true, crashed: true, crashKind: 'obstacle' }), wet),
    ).toBe('hit_obstacle');
  });

  it('kegagalan murni soal pintu: kunci tertulis skenario yang bicara', () => {
    expect(resolveScenarioFailKey(state({ awake: true, gateOpen: false }), dry)).toBe(
      'gate_still_closed',
    );
    expect(resolveScenarioFailKey(state({ awake: true, gateOpen: true }), wet)).toBe(
      'opened_when_wet',
    );
  });

  it('skenario tanpa failReactionKey: jatuh ke kunci turunan seperti sebelumnya', () => {
    const bare = { ...dry, failReactionKey: undefined };
    expect(resolveScenarioFailKey(state({ awake: true, gateOpen: false }), bare)).toBe(
      'gate_still_closed',
    );
  });
});

describe('resolveScenarioFailKey — integrasi Q3 lewat interpreter asli', () => {
  it('skrip if/else TANPA boot sama sekali: dinarasikan wrong_order (repro PT2-F3)', async () => {
    const noBoot = `if (sensor.soilMoisture < 40) {
  gate.open();
} else {
  gate.close();
}`;
    const results = await runBotScenariosHeadless(quest03PintuAir, allowed, noBoot);
    expect(results[0].pass).toBe(false);
    expect(results[0].state.awake).toBe(false);
    expect(resolveScenarioFailKey(results[0].state, dry)).toBe('wrong_order');
  });

  it('hardcode gate.open(): babak basah tetap opened_when_wet', async () => {
    const cheat = 'piko.boot();\ngate.open();';
    const results = await runBotScenariosHeadless(quest03PintuAir, allowed, cheat);
    expect(results.map((r) => r.pass)).toEqual([true, false]);
    expect(resolveScenarioFailKey(results[1].state, wet)).toBe('opened_when_wet');
  });

  it('boot saja, pintu tak pernah disentuh: gate_still_closed tidak berubah', async () => {
    const run = await runBotHeadless(setup, allowed, 'piko.boot();', { soilMoisture: 25 });
    expect(run.state.gateOpen).toBe(false);
    expect(resolveScenarioFailKey(run.state, dry)).toBe('gate_still_closed');
  });

  it('berjalan menabrak batas grid: out_of_bounds, bukan soal pintu', async () => {
    const crash = 'piko.boot();\npiko.moveForward(9);';
    const run = await runBotHeadless(setup, allowed, crash, { soilMoisture: 25 });
    expect(run.state.crashed).toBe(true);
    expect(run.state.crashKind).toBe('bounds');
    expect(resolveScenarioFailKey(run.state, dry)).toBe('out_of_bounds');
  });

  it('solusi rujukan if/else tetap lulus kedua skenario', async () => {
    const solution = `
piko.boot();
piko.moveForward(5);
if (sensor.soilMoisture < 40) {
  gate.open();
} else {
  gate.close();
}
`;
    const results = await runBotScenariosHeadless(quest03PintuAir, allowed, solution);
    expect(results.map((r) => r.pass)).toEqual([true, true]);
  });
});
