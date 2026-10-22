import { describe, expect, it } from 'vitest';
import type { QuestDefinition } from '../../shared/types';
import {
  botQuestVerdict,
  botScenarioFailKey,
  createBotStageReducer,
  createBotStageState,
  evaluateBotExpectation,
  normalizeBotAction,
  type BotActionKind,
  type BotStageAction,
  type BotStageState,
} from './botStageLogic';

type Setup = NonNullable<QuestDefinition['botWorldSetup']>;

const act = (kind: BotActionKind, stepsArg?: unknown): BotStageAction => ({
  type: 'bot',
  kind,
  stepsArg,
});

function runActions(setup: Setup, actions: BotStageAction[]): BotStageState {
  const reduce = createBotStageReducer(setup);
  return actions.reduce(
    reduce,
    createBotStageState(setup, setup.startPos ?? [0, 0]),
  );
}

describe('normalizeBotAction — aksi Fase 3', () => {
  it('piko.water terpetakan ke water; gate tetap open/close', () => {
    expect(normalizeBotAction('piko.water')).toBe('water');
    expect(normalizeBotAction('gate.open')).toBe('open');
    expect(normalizeBotAction('gate.close')).toBe('close');
  });
});

describe('peti dorong (Q5) — aturan geser', () => {
  const setup: Setup = {
    gridSize: [7, 3],
    startPos: [0, 1],
    targets: [[5, 1]],
    boxes: [[2, 1]],
    obstacles: [],
  };

  it('melangkah ke peti mendorongnya satu petak; robot mengambil tempat peti', () => {
    const s = runActions(setup, [act('boot'), act('move', 1), act('move', 1)]);
    expect([s.x, s.y]).toEqual([2, 1]);
    expect(s.boxes).toEqual([[3, 1]]);
    expect(s.crashed).toBe(false);
  });

  it('moveForward besar mendorong beruntun sampai peti di target', () => {
    const s = runActions(setup, [act('boot'), act('move', 4)]);
    expect(s.boxes).toEqual([[5, 1]]);
    expect([s.x, s.y]).toEqual([4, 1]);
    expect(s.boxesPlaced).toBe(1);
    expect(s.allBoxesOnTargets).toBe(true);
  });

  it('mendorong peti ke dinding = tabrakan: peti & robot berhenti', () => {
    const walled: Setup = { ...setup, obstacles: [[4, 1]] };
    const s = runActions(walled, [act('boot'), act('move', 3)]);
    expect(s.boxes).toEqual([[3, 1]]);
    expect([s.x, s.y]).toEqual([2, 1]);
    expect(s.crashed).toBe(true);
    expect(s.crashKind).toBe('obstacle');
  });

  it('mendorong peti ke peti lain = tabrakan, tidak ada yang bergerak', () => {
    const two: Setup = { ...setup, boxes: [[2, 1], [3, 1]] };
    const s = runActions(two, [act('boot'), act('move', 1), act('move', 1)]);
    expect(s.boxes).toEqual([
      [2, 1],
      [3, 1],
    ]);
    expect([s.x, s.y]).toEqual([1, 1]);
    expect(s.crashed).toBe(true);
  });

  it('mendorong peti keluar batas: crash bounds, peti berhenti di tepi & terjepit', () => {
    const s = runActions(setup, [act('boot'), act('move', 6)]);
    expect(s.boxes).toEqual([[6, 1]]);
    expect(s.crashKind).toBe('bounds');
    expect(s.boxesStuck).toBe(true);
    expect(s.allBoxesOnTargets).toBe(false);
  });

  it('peti tidak bisa didorong masuk ke petak tanaman', () => {
    const withPlant: Setup = { ...setup, plants: [[4, 1]] };
    const s = runActions(withPlant, [act('boot'), act('move', 3)]);
    expect(s.boxes).toEqual([[3, 1]]);
    expect(s.crashed).toBe(true);
    expect(s.crashKind).toBe('obstacle');
  });

  it('mendorong sebelum boot fizzle total (F-01 berlaku juga untuk peti)', () => {
    const s = runActions(setup, [act('move', 3)]);
    expect(s.boxes).toEqual([[2, 1]]);
    expect([s.x, s.y]).toEqual([0, 1]);
    expect(s.actedWhileAsleep).toBe(true);
  });
});

describe('siram tanaman (Q7) — semantik water()', () => {
  const setup: Setup = {
    gridSize: [4, 3],
    startPos: [0, 1],
    targets: [],
    plants: [
      [1, 1],
      [2, 1],
    ],
    obstacles: [],
  };

  it('water() menyiram tanaman di petak robot berdiri', () => {
    const s = runActions(setup, [act('boot'), act('move', 1), act('water')]);
    expect(s.wateredPlants).toEqual(['1,1']);
    expect(s.plantsWatered).toBe(1);
    expect(s.allPlantsWatered).toBe(false);
    expect(s.droplet).toBe(true);
    const s2 = runActions(setup, [
      act('boot'),
      act('move', 1),
      act('water'),
      act('move', 1),
      act('water'),
    ]);
    expect(s2.allPlantsWatered).toBe(true);
    expect(s2.plantsWatered).toBe(2);
  });

  it('water() di petak kosong = percikan percuma, tercatat, tidak menyiram apa pun', () => {
    const s = runActions(setup, [act('boot'), act('water')]);
    expect(s.wateredPlants).toEqual([]);
    expect(s.waterWasted).toBe(1);
    expect(s.splash).toBe(true);
  });

  it('menyiram tanaman yang sudah basah juga percuma', () => {
    const s = runActions(setup, [
      act('boot'),
      act('move', 1),
      act('water'),
      act('water'),
    ]);
    expect(s.plantsWatered).toBe(1);
    expect(s.waterWasted).toBe(1);
  });

  it('water() sebelum boot fizzle (F-01)', () => {
    const s = runActions(setup, [act('move', 1), act('water')]);
    expect(s.wateredPlants).toEqual([]);
    expect(s.actedWhileAsleep).toBe(true);
  });

  it('petak tanaman BOLEH diinjak robot (bukan rintangan)', () => {
    const s = runActions(setup, [act('boot'), act('move', 2)]);
    expect([s.x, s.y]).toEqual([2, 1]);
    expect(s.crashed).toBe(false);
  });
});

describe('pintu air (Q3) — gate di panggung', () => {
  const setup: Setup = {
    gridSize: [8, 5],
    startPos: [0, 2],
    targets: [[5, 2]],
    gateTile: [7, 2],
    obstacles: [],
  };

  it('open/close mengubah gateOpen; open sebelum boot fizzle', () => {
    const asleep = runActions(setup, [act('open')]);
    expect(asleep.gateOpen).toBe(false);
    expect(asleep.actedWhileAsleep).toBe(true);
    const opened = runActions(setup, [act('boot'), act('open')]);
    expect(opened.gateOpen).toBe(true);
    const closed = runActions(setup, [act('boot'), act('open'), act('close')]);
    expect(closed.gateOpen).toBe(false);
  });

  it('arah hadap awal dari setup.startFacing dihormati', () => {
    const s = createBotStageState({ ...setup, startFacing: 2 }, [0, 2]);
    expect(s.facing).toBe(2);
  });
});

describe('verdict cabang peti & tanaman', () => {
  const boxSetup: Setup = {
    gridSize: [7, 3],
    startPos: [0, 1],
    targets: [[5, 1]],
    boxes: [[2, 1]],
    obstacles: [],
  };
  const boxReactions = {
    wrong_order: 'x',
    boxes_incomplete: 'x',
    box_stuck: 'x',
    hit_obstacle: 'x',
    out_of_bounds: 'x',
  };

  it('peti belum sampai → boxes_incomplete; terjepit → box_stuck; lengkap → sukses', () => {
    const partial = runActions(boxSetup, [act('boot'), act('move', 1)]);
    expect(botQuestVerdict(partial, boxReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'boxes_incomplete',
    });
    const stuck = runActions(boxSetup, [act('boot'), act('move', 6)]);
    expect(botQuestVerdict(stuck, boxReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'box_stuck',
    });
    const done = runActions(boxSetup, [act('boot'), act('move', 4)]);
    expect(botQuestVerdict(done, boxReactions)).toEqual({ kind: 'success' });
  });

  it('tabrakan TIDAK menelan peti yang sudah lengkap (sukses dicek pertama)', () => {
    const s = runActions(boxSetup, [
      act('boot'),
      act('move', 4), // peti sampai target
      act('turn-left'),
      act('move', 5), // lalu nabrak batas di utara
    ]);
    expect(s.crashed).toBe(true);
    expect(botQuestVerdict(s, boxReactions)).toEqual({ kind: 'success' });
  });

  const plantSetup: Setup = {
    gridSize: [4, 3],
    startPos: [0, 1],
    targets: [],
    plants: [
      [1, 1],
      [2, 1],
    ],
    obstacles: [],
  };
  const plantReactions = {
    wrong_order: 'x',
    plants_dry: 'x',
    watered_empty: 'x',
    hit_obstacle: 'x',
    out_of_bounds: 'x',
  };

  it('tanaman: sebagian kering → plants_dry; siram kosong saja → watered_empty; lengkap → sukses', () => {
    const partial = runActions(plantSetup, [act('boot'), act('move', 1), act('water')]);
    expect(botQuestVerdict(partial, plantReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'plants_dry',
    });
    const wasted = runActions(plantSetup, [act('boot'), act('water')]);
    expect(botQuestVerdict(wasted, plantReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'watered_empty',
    });
    const done = runActions(plantSetup, [
      act('boot'),
      act('move', 1),
      act('water'),
      act('move', 1),
      act('water'),
    ]);
    expect(botQuestVerdict(done, plantReactions)).toEqual({ kind: 'success' });
  });
});

describe('evaluasi skenario (Q3)', () => {
  const setup: Setup = {
    gridSize: [8, 5],
    startPos: [0, 2],
    targets: [[5, 2]],
    gateTile: [7, 2],
    obstacles: [],
  };

  it('evaluateBotExpectation hanya menilai field yang disebut', () => {
    const opened = runActions(setup, [act('boot'), act('open')]);
    expect(evaluateBotExpectation(opened, { gateOpen: true })).toEqual({
      pass: true,
      mismatches: [],
    });
    expect(evaluateBotExpectation(opened, { gateOpen: false })).toEqual({
      pass: false,
      mismatches: ['gateOpen'],
    });
    // charged tidak disebut → tidak dinilai walau robot belum charge.
    expect(evaluateBotExpectation(opened, {})).toEqual({ pass: true, mismatches: [] });
  });

  it('botScenarioFailKey: kering-gagal vs basah-gagal adalah lelucon berbeda', () => {
    const closedState = runActions(setup, [act('boot')]);
    expect(botScenarioFailKey(closedState, { gateOpen: true })).toBe('gate_still_closed');
    const openedState = runActions(setup, [act('boot'), act('open')]);
    expect(botScenarioFailKey(openedState, { gateOpen: false })).toBe('opened_when_wet');
    const asleepState = runActions(setup, []);
    expect(botScenarioFailKey(asleepState, { gateOpen: true })).toBe('wrong_order');
  });
});
