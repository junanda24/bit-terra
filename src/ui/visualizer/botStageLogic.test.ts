import { describe, expect, it } from 'vitest';
import {
  botQuestVerdict,
  botStageStatusText,
  createBotStageReducer,
  createBotStageState,
  normalizeMoveSteps,
  type BotStageAction,
  type BotStageState,
} from './botStageLogic';
import { quest01BangunPiko } from '../../content/quests/quest_01_bangun_piko';

const setup = quest01BangunPiko.botWorldSetup!;
const REACTIONS = quest01BangunPiko.onFailFunnyReactions;
const START: [number, number] = [0, 2];

function run(actions: BotStageAction[]): BotStageState {
  const reduce = createBotStageReducer(setup);
  return actions.reduce(reduce, createBotStageState(setup, START));
}
import type { BotActionKind } from './botStageLogic';
const bot = (kind: BotActionKind, stepsArg?: unknown): BotStageAction => ({
  type: 'bot',
  kind,
  stepsArg,
});

describe('normalizeMoveSteps (F-12a)', () => {
  it('0 tetap 0 dan negatif menjadi 0 — kode tidak dibohongi', () => {
    expect(normalizeMoveSteps(0)).toBe(0);
    expect(normalizeMoveSteps(-3)).toBe(0);
  });
  it('angka difloorkan; tanpa argumen = 1 langkah', () => {
    expect(normalizeMoveSteps(3.9)).toBe(3);
    expect(normalizeMoveSteps(undefined)).toBe(1);
    expect(normalizeMoveSteps('tiga')).toBe(1);
  });
});

describe('penegakan urutan boot (F-01)', () => {
  it('move & charge sebelum boot GAGAL TOTAL: tidak bergerak, tidak terisi, hanya fizzle', () => {
    const s = run([bot('move', 3), bot('charge')]);
    expect(s.x).toBe(0);
    expect(s.y).toBe(2);
    expect(s.charged).toBe(false);
    expect(s.awake).toBe(false);
    expect(s.sleepFizzle).toBe(true);
    expect(s.actedWhileAsleep).toBe(true);
  });

  it('urutan terbalik ala M4 (move, charge, boot terakhir) TIDAK bisa sukses', () => {
    const s = run([bot('move', 3), bot('charge'), bot('boot')]);
    expect(s.x).toBe(0);
    expect(s.charged).toBe(false);
    const v = botQuestVerdict(s, REACTIONS);
    expect(v).toEqual({ kind: 'fail', reactionKey: 'wrong_order' });
  });

  it('solusi benar (boot, move 3, charge) sukses penuh', () => {
    const s = run([bot('boot'), bot('move', 3), bot('charge')]);
    expect(s).toMatchObject({ x: 3, y: 2, awake: true, charged: true, onTarget: true });
    expect(botQuestVerdict(s, REACTIONS)).toEqual({ kind: 'success' });
  });

  it('moveForward(0) setelah boot benar-benar diam di tempat', () => {
    const s = run([bot('boot'), bot('move', 0)]);
    expect(s.x).toBe(0);
    expect(s.crashed).toBe(false);
  });
});

describe('charge di tempat gelap ≠ tabrakan (F-02)', () => {
  it('M1: jalan 5 petak lalu charge gelap → charged-dark, BUKAN crash', () => {
    const s = run([bot('boot'), bot('move', 5), bot('charge')]);
    expect(s.x).toBe(5);
    expect(s.charged).toBe(false);
    expect(s.chargedDark).toBe(true);
    expect(s.crashed).toBe(false);
    expect(s.dizzy).toBe(false);
    expect(s.dimZap).toBe(true);
    expect(s.status).toBe('charged-dark');
    expect(botQuestVerdict(s, REACTIONS)).toEqual({
      kind: 'fail',
      reactionKey: 'not_on_target',
    });
  });

  it('M6: kurang satu petak lalu charge → not_on_target, bukan teks tabrakan', () => {
    const s = run([bot('boot'), bot('move', 2), bot('charge')]);
    expect(botQuestVerdict(s, REACTIONS)).toEqual({
      kind: 'fail',
      reactionKey: 'not_on_target',
    });
  });

  it('M5: charge di pojok start lalu jalan ke cahaya → verdict no_charge (sudah di cahaya, tinggal charge)', () => {
    const s = run([bot('boot'), bot('charge'), bot('move', 3)]);
    expect(s.onTarget).toBe(true);
    expect(s.charged).toBe(false);
    expect(botQuestVerdict(s, REACTIONS)).toEqual({
      kind: 'fail',
      reactionKey: 'no_charge',
    });
  });

  it('tabrakan rintangan sungguhan → crashed + crashKind obstacle → hit_obstacle', () => {
    // (7,2) adalah rintangan: jalan 9 petak berhenti di (6,2) karena tabrak.
    const afterMove = run([bot('boot'), bot('move', 9)]);
    expect(afterMove.x).toBe(6);
    expect(afterMove.crashed).toBe(true);
    expect(afterMove.crashKind).toBe('obstacle');
    // Bintang pusing adalah sinyal sesaat tepat saat tabrakan terjadi;
    // sinyal abadinya adalah latch crashed/crashKind.
    expect(afterMove.dizzy).toBe(true);
    // Charge sesudahnya (di tempat gelap) tidak menghapus latch tabrakan,
    // dan verdict tetap mendahulukan tabrakan sungguhan.
    const s = run([bot('boot'), bot('move', 9), bot('charge')]);
    expect(s.crashed).toBe(true);
    expect(s.crashKind).toBe('obstacle');
    expect(botQuestVerdict(s, REACTIONS)).toEqual({
      kind: 'fail',
      reactionKey: 'hit_obstacle',
    });
  });

  it('keluar batas grid → crashKind bounds', () => {
    const s = run([bot('boot'), bot('turn-left'), bot('move', 5)]);
    expect(s.crashed).toBe(true);
    expect(s.crashKind).toBe('bounds');
    expect(botQuestVerdict(s, REACTIONS)).toEqual({
      kind: 'fail',
      reactionKey: 'out_of_bounds',
    });
  });

  it('crash yang terkunci tidak tertimpa kejadian berikutnya, dan reset membersihkannya', () => {
    const reduce = createBotStageReducer(setup);
    let s = createBotStageState(setup, START);
    s = reduce(s, bot('boot'));
    s = reduce(s, bot('move', 9)); // tabrak (7,2)
    expect(s.crashed).toBe(true);
    s = reduce(s, bot('move', 1));
    expect(s.crashed).toBe(true); // tetap terkunci selama run ini
    s = reduce(s, { type: 'reset', startPos: START });
    expect(s.crashed).toBe(false);
    expect(s.crashKind).toBeNull();
    expect(s.awake).toBe(false);
    expect(s.x).toBe(0);
  });
});

describe('label status (F-12b)', () => {
  it('tertidur selalu menang — tidak pernah "daya terisi" saat belum boot', () => {
    const s = run([bot('charge')]); // fizzle, charged tetap false
    expect(botStageStatusText(s)).toBe('Piko tertidur');
  });
  it('charged-dark punya labelnya sendiri', () => {
    const s = run([bot('boot'), bot('charge')]);
    expect(botStageStatusText(s)).toBe('Tidak ada cahaya di sini');
  });
  it('sukses → "Daya terisi penuh"', () => {
    const s = run([bot('boot'), bot('move', 3), bot('charge')]);
    expect(botStageStatusText(s)).toBe('Daya terisi penuh');
  });
});
