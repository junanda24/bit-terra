import { describe, expect, it } from 'vitest';
import { ScriptLinter } from '../../sandbox/script/ScriptLinter';
import type { QuestDefinition } from '../../shared/types';
import { getQuestDialogue } from '../dialogues/q1_q2_dialogues';
import { getCartridgeSnippet } from '../../ui/hud/cartridgeSnippets';
import { allowedBotFunctions } from '../../ui/cyberdeck/CyberDeckScreen';
import {
  botQuestVerdict,
  botScenarioFailKey,
  evaluateBotExpectation,
} from '../../ui/visualizer/botStageLogic';
import {
  runBotHeadless,
  runBotScenariosHeadless,
} from '../../ui/visualizer/botScenarioRunner';
import { FUTURE_QUEST_IDS, INTERACTABLES } from '../../world/mapData';
import { quest03PintuAir } from './quest_03_pintu_air';
import { quest05KonveyorRoti } from './quest_05_konveyor_roti';
import { quest07JembatanKristal } from './quest_07_jembatan_kristal';

const BOT_QUESTS: QuestDefinition[] = [
  quest03PintuAir,
  quest05KonveyorRoti,
  quest07JembatanKristal,
];

/** Solusi referensi Q3: baca sensor, buka saat kering, tutup saat basah. */
const Q3_SOLUTION = `
piko.boot();
piko.moveForward(5);
if (sensor.soilMoisture < 40) {
  gate.open();
} else {
  gate.close();
}
`;

/** Solusi referensi Q5: fungsi dorong + loop, tiga lajur (jejak diverifikasi). */
const Q5_SOLUTION = `
piko.boot();
function dorongSampaiRak() {
  for (let i = 0; i < 4; i++) {
    piko.moveForward(1);
  }
}
piko.moveForward(2);
dorongSampaiRak();
piko.turnLeft();
piko.turnLeft();
piko.moveForward(6);
piko.turnRight();
piko.moveForward(1);
piko.turnRight();
piko.moveForward(2);
dorongSampaiRak();
piko.turnLeft();
piko.turnLeft();
piko.moveForward(6);
piko.turnLeft();
piko.moveForward(2);
piko.turnLeft();
piko.moveForward(2);
dorongSampaiRak();
`;

/** Solusi referensi Q7: loop bersarang — 4 sisi × (3 langkah siram + 2 langkah). */
const Q7_SOLUTION = `
piko.boot();
function siramSisi() {
  for (let i = 0; i < 3; i++) {
    piko.moveForward(1);
    piko.water();
  }
  piko.moveForward(2);
}
for (let sisi = 0; sisi < 4; sisi++) {
  siramSisi();
  piko.turnRight();
}
`;

describe('konten Q3/Q5/Q7 — bentuk mengikuti pola quest yang ada', () => {
  it.each(BOT_QUESTS.map((q) => [q.id, q] as const))(
    '%s: mode BOT, 3 petunjuk, dialog lengkap, kartrid punya snippet asli',
    (_id, quest) => {
      expect(quest.mode).toBe('BOT_SCRIPT');
      expect(quest.hints).toHaveLength(3);
      expect(quest.storyContext.length).toBeGreaterThan(20);
      expect(quest.onSuccessWorldEvents.length).toBeGreaterThan(0);
      for (const phase of ['intro', 'success', 'funnyFail'] as const) {
        expect(getQuestDialogue(quest.id, phase)?.length).toBeGreaterThan(0);
      }
      for (const phase of ['hint1', 'hint2', 'hint3'] as const) {
        expect(getQuestDialogue(quest.id, phase)?.length).toBeGreaterThan(0);
      }
      for (const cart of quest.unlockedCartridges) {
        // Snippet asli, bukan fallback `${nama} ` untuk kartrid tak dikenal.
        expect(getCartridgeSnippet(cart)).not.toBe(`${cart} `);
      }
      // Jangkar dunia: satu anchor quest yang menunjuk quest ini, dan id-nya
      // sudah keluar dari daftar "masa depan" (FUTURE_QUEST_IDS).
      const anchors = INTERACTABLES.filter(
        (i) => i.kind === 'quest' && i.questId === quest.id,
      );
      expect(anchors).toHaveLength(1);
      expect(FUTURE_QUEST_IDS as readonly string[]).not.toContain(quest.id);
    },
  );

  it('kerangka awal (initialCode) hanya mengandung error blanko ___', () => {
    for (const quest of BOT_QUESTS) {
      const allowed = allowedBotFunctions(quest);
      const result = ScriptLinter.lint(quest.initialCode, allowed);
      expect(result.length).toBeGreaterThan(0);
      for (const err of result) {
        expect(err.code, `${quest.id}: ${err.message}`).toBe('blank');
      }
    }
  });

  it('solusi referensi lolos linter tanpa error untuk ketiga quest', () => {
    const pairs: [QuestDefinition, string][] = [
      [quest03PintuAir, Q3_SOLUTION],
      [quest05KonveyorRoti, Q5_SOLUTION],
      [quest07JembatanKristal, Q7_SOLUTION],
    ];
    for (const [quest, solution] of pairs) {
      const result = ScriptLinter.lint(solution, allowedBotFunctions(quest));
      expect(result, quest.id).toEqual([]);
    }
  });
});

describe('linter: blanko ___ di posisi baca (batas loop, kondisi)', () => {
  it('batas loop `i < ___` dan kondisi `if (___)` ter-flag blank, bukan lolos', () => {
    const allowed = ['piko.moveForward', 'piko.boot', 'gate.open'];
    const loopBlank = ScriptLinter.lint(
      'for (let i = 0; i < ___; i++) { piko.moveForward(1); }',
      allowed,
    );
    expect(loopBlank.some((e) => e.code === 'blank')).toBe(true);
    const condBlank = ScriptLinter.lint('if (___) { gate.open(); }', allowed);
    expect(condBlank.some((e) => e.code === 'blank')).toBe(true);
    const calleeBlank = ScriptLinter.lint('___();', allowed);
    expect(calleeBlank.some((e) => e.code === 'blank')).toBe(true);
  });
});

describe('Q3 — verdict SKENARIO (anti-hardcode)', () => {
  const allowed = allowedBotFunctions(quest03PintuAir);
  const setup = quest03PintuAir.botWorldSetup!;
  const [dry, wet] = quest03PintuAir.botScenarios!;

  it('punya tepat dua skenario: kering 25 → terbuka, basah 85 → tertutup', () => {
    expect(quest03PintuAir.botScenarios).toHaveLength(2);
    expect(dry.setup.soilMoisture).toBe(25);
    expect(dry.expected.gateOpen).toBe(true);
    expect(wet.setup.soilMoisture).toBe(85);
    expect(wet.expected.gateOpen).toBe(false);
  });

  it('solusi referensi LULUS kedua skenario lewat interpreter asli', async () => {
    const results = await runBotScenariosHeadless(quest03PintuAir, allowed, Q3_SOLUTION);
    expect(results.map((r) => r.error)).toEqual([undefined, undefined]);
    expect(results.map((r) => r.pass)).toEqual([true, true]);
    // Bukti cabang if/else benar-benar dua arah:
    const dryRun = await runBotHeadless(setup, allowed, Q3_SOLUTION, { soilMoisture: 25 });
    expect(dryRun.calls.map((c) => c.action)).toContain('gate.open');
    const wetRun = await runBotHeadless(setup, allowed, Q3_SOLUTION, { soilMoisture: 85 });
    expect(wetRun.calls.map((c) => c.action)).toContain('gate.close');
    expect(wetRun.state.gateOpen).toBe(false);
  });

  it('hardcode gate.open() saja: lulus kering, GAGAL basah sebagai opened_when_wet', async () => {
    const cheat = 'piko.boot();\ngate.open();';
    const results = await runBotScenariosHeadless(quest03PintuAir, allowed, cheat);
    expect(results[0].pass).toBe(true);
    expect(results[1].pass).toBe(false);
    const wetRun = await runBotHeadless(setup, allowed, cheat, { soilMoisture: 85 });
    expect(botScenarioFailKey(wetRun.state, wet.expected)).toBe('opened_when_wet');
  });

  it('tidak pernah membuka: GAGAL kering sebagai gate_still_closed', async () => {
    const lazy = 'piko.boot();\npiko.moveForward(5);';
    const dryRun = await runBotHeadless(setup, allowed, lazy, { soilMoisture: 25 });
    expect(botScenarioFailKey(dryRun.state, dry.expected)).toBe('gate_still_closed');
  });

  it('kondisi terbalik (>= 40) gagal di kedua skenario', async () => {
    const inverted = `
piko.boot();
if (sensor.soilMoisture >= 40) { gate.open(); } else { gate.close(); }
`;
    const results = await runBotScenariosHeadless(quest03PintuAir, allowed, inverted);
    expect(results.map((r) => r.pass)).toEqual([false, false]);
  });

  it('tanpa boot: gate.open() fizzle di panggung → wrong_order', async () => {
    const noBoot = 'gate.open();';
    const dryRun = await runBotHeadless(setup, allowed, noBoot, { soilMoisture: 25 });
    expect(dryRun.state.gateOpen).toBe(false);
    expect(botScenarioFailKey(dryRun.state, dry.expected)).toBe('wrong_order');
  });
});

describe('Q5 — solusi referensi & verdict peti lewat interpreter asli', () => {
  const allowed = allowedBotFunctions(quest05KonveyorRoti);
  const setup = quest05KonveyorRoti.botWorldSetup!;

  it('solusi referensi: ketiga peti mendarat di target, verdict sukses', async () => {
    const run = await runBotHeadless(setup, allowed, Q5_SOLUTION);
    expect(run.error).toBeUndefined();
    expect(run.state.crashed).toBe(false);
    expect(run.state.allBoxesOnTargets).toBe(true);
    expect(run.state.boxesPlaced).toBe(3);
    expect(botQuestVerdict(run.state, quest05KonveyorRoti.onFailFunnyReactions)).toEqual({
      kind: 'success',
    });
  });

  it('sebagian lajur saja → boxes_incomplete', async () => {
    const partial = `
piko.boot();
piko.moveForward(2);
for (let i = 0; i < 4; i++) { piko.moveForward(1); }
`;
    const run = await runBotHeadless(setup, allowed, partial);
    expect(run.state.boxesPlaced).toBe(1);
    expect(botQuestVerdict(run.state, quest05KonveyorRoti.onFailFunnyReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'boxes_incomplete',
    });
  });

  it('mendorong terus sampai tepi grid → box_stuck', async () => {
    const stuck = `
piko.boot();
piko.moveForward(2);
piko.moveForward(7);
`;
    const run = await runBotHeadless(setup, allowed, stuck);
    expect(run.state.boxesStuck).toBe(true);
    expect(botQuestVerdict(run.state, quest05KonveyorRoti.onFailFunnyReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'box_stuck',
    });
  });
});

describe('Q7 — solusi referensi & verdict tanaman lewat interpreter asli', () => {
  const allowed = allowedBotFunctions(quest07JembatanKristal);
  const setup = quest07JembatanKristal.botWorldSetup!;

  it('solusi loop bersarang: 12/12 tanaman tersiram, robot pulang ke (1,1)', async () => {
    const run = await runBotHeadless(setup, allowed, Q7_SOLUTION);
    expect(run.error).toBeUndefined();
    expect(run.state.crashed).toBe(false);
    expect(run.state.plantsWatered).toBe(12);
    expect(run.state.allPlantsWatered).toBe(true);
    expect([run.state.x, run.state.y]).toEqual([1, 1]);
    expect(botQuestVerdict(run.state, quest07JembatanKristal.onFailFunnyReactions)).toEqual({
      kind: 'success',
    });
  });

  it('satu sisi saja → plants_dry; siram di tempat kosong saja → watered_empty', async () => {
    const oneSide = `
piko.boot();
for (let i = 0; i < 3; i++) { piko.moveForward(1); piko.water(); }
`;
    const run1 = await runBotHeadless(setup, allowed, oneSide);
    expect(run1.state.plantsWatered).toBe(3);
    expect(botQuestVerdict(run1.state, quest07JembatanKristal.onFailFunnyReactions)).toEqual({
      kind: 'fail',
      reactionKey: 'plants_dry',
    });
    const wasted = await runBotHeadless(setup, allowed, 'piko.boot();\npiko.water();');
    expect(botQuestVerdict(wasted.state, quest07JembatanKristal.onFailFunnyReactions)).toEqual(
      { kind: 'fail', reactionKey: 'watered_empty' },
    );
  });
});

describe('penutupan kunci reaksi — setiap kegagalan yang bisa terjadi punya leluconnya', () => {
  it('semua kunci dari baterai skrip gagal ada di onFailFunnyReactions quest-nya', async () => {
    const produced = new Set<string>();
    const collect = async (quest: QuestDefinition, scripts: { code: string; soil?: number }[]) => {
      const allowed = allowedBotFunctions(quest);
      const setup = quest.botWorldSetup!;
      for (const { code, soil } of scripts) {
        const run = await runBotHeadless(setup, allowed, code, { soilMoisture: soil });
        if (quest.botScenarios) {
          for (const sc of quest.botScenarios) {
            const r = await runBotHeadless(setup, allowed, code, {
              soilMoisture: sc.setup.soilMoisture ?? soil,
            });
            // Kunci skenario hanya bermakna saat ekspektasinya GAGAL.
            if (!evaluateBotExpectation(r.state, sc.expected).pass) {
              produced.add(`${quest.id}:${botScenarioFailKey(r.state, sc.expected)}`);
            }
          }
        }
        const v = botQuestVerdict(run.state, quest.onFailFunnyReactions);
        if (v.kind === 'fail') produced.add(`${quest.id}:${v.reactionKey}`);
      }
    };

    await collect(quest03PintuAir, [
      { code: 'piko.moveForward(1);' }, // tanpa boot
      { code: 'piko.boot();\ngate.open();', soil: 85 }, // buka saat basah
      { code: 'piko.boot();\npiko.moveForward(5);', soil: 25 }, // tak pernah buka
      { code: 'piko.boot();\npiko.turnLeft();\npiko.moveForward(3);' }, // nabrak rintangan
      { code: 'piko.boot();\npiko.moveForward(99);' }, // keluar batas
      { code: 'piko.boot();\npiko.moveForward(1);' }, // berhenti di tengah
    ]);
    await collect(quest05KonveyorRoti, [
      { code: 'piko.moveForward(2);' }, // tanpa boot
      { code: 'piko.boot();\npiko.moveForward(2);\nfor (let i = 0; i < 4; i++) { piko.moveForward(1); }' }, // sebagian
      { code: 'piko.boot();\npiko.moveForward(2);\npiko.moveForward(7);' }, // terjepit
      { code: 'piko.boot();\npiko.moveForward(1);\npiko.turnRight();\npiko.moveForward(2);\npiko.turnLeft();\npiko.moveForward(2);' }, // nabrak rintangan
      { code: 'piko.boot();\npiko.turnLeft();\npiko.moveForward(5);' }, // keluar batas
    ]);
    await collect(quest07JembatanKristal, [
      { code: 'piko.moveForward(1);' }, // tanpa boot
      { code: 'piko.boot();\npiko.water();' }, // siram kosong
      { code: 'piko.boot();\nfor (let i = 0; i < 3; i++) { piko.moveForward(1); piko.water(); }' }, // sebagian
      { code: 'piko.boot();\npiko.turnLeft();\npiko.moveForward(1);' }, // nabrak akar
    ]);

    expect(produced.size).toBeGreaterThan(10);
    for (const entry of produced) {
      const [questId, key] = entry.split(':');
      const quest = BOT_QUESTS.find((q) => q.id === questId)!;
      expect(
        quest.onFailFunnyReactions[key],
        `${questId} kehilangan reaksi '${key}'`,
      ).toBeTruthy();
    }
    // Catatan: kunci 'interpreter_error' TIDAK hidup di konten — deck
    // memanggil funnyFail dengan teks eksplisit dari FriendlyError-nya
    // (CyberDeckScreen), jadi yang wajib ada di konten adalah fallback
    // umum 'wrong_result'.
    for (const quest of BOT_QUESTS) {
      expect(quest.onFailFunnyReactions.wrong_result).toBeTruthy();
    }
  });
});
