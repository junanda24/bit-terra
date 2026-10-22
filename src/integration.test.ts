// Integration proof for Fase 1 (BLUEPRINT §6): the REAL quest content data
// driven through the REAL sandboxes — exactly what content/quests/index.ts
// asked integration to verify instead of eyeballing.
import { describe, expect, it } from 'vitest';
import { ALL_QUESTS, getQuestById } from './content/quests/index';
import { quest01BangunPiko } from './content/quests/quest_01_bangun_piko';
import { quest02DombaTersesat } from './content/quests/quest_02_domba_tersesat';
import { SqliteWasmRunner } from './sandbox/sql/SqliteWasmRunner';
import { SqlAstLinter } from './sandbox/sql/SqlAstLinter';
import { ResultDiffChecker } from './sandbox/sql/ResultDiffChecker';
import { MockBot } from './sandbox/script/BotApiBindings';
import { runBotScript } from './sandbox/script/StepInterpreter';
import type { StepEvent } from './shared/types';

describe('konten quest Fase 1', () => {
  it('ALL_QUESTS memuat Q1 + Q2 dan getQuestById menemukannya', () => {
    expect(ALL_QUESTS).toHaveLength(2);
    expect(getQuestById(quest01BangunPiko.id)?.title).toBe('Bangun, Piko!');
    expect(getQuestById(quest02DombaTersesat.id)?.title).toBe('Domba yang Tersesat');
    expect(getQuestById('tidak-ada')).toBeUndefined();
  });
});

describe('Q2 Domba yang Tersesat — SQL end-to-end', () => {
  it('seed asli + query solusi lulus ResultDiffChecker; tanpa WHERE gagal', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(quest02DombaTersesat.sqlSeedScript!);
    try {
      const solved = runner.runQuery(
        "SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST'",
      );
      const diff = ResultDiffChecker.check(solved, quest02DombaTersesat.expectedSqlResult!, {
        orderMatters: false,
      });
      expect(diff.diffs).toEqual([]);
      expect(diff.pass).toBe(true);
      expect(solved.rows).toHaveLength(3);

      const noWhere = runner.runQuery('SELECT sheep_name, last_zone FROM livestock_logs');
      const diffFail = ResultDiffChecker.check(noWhere, quest02DombaTersesat.expectedSqlResult!, {
        orderMatters: false,
      });
      expect(diffFail.pass).toBe(false);
    } finally {
      runner.dispose();
    }
  });

  it('linter menyarankan sheep_name saat pemain mengetik nama_domba', async () => {
    const runner = new SqliteWasmRunner();
    await runner.init(quest02DombaTersesat.sqlSeedScript!);
    try {
      const errors = SqlAstLinter.lint(
        "SELECT nama_domba, last_zone FROM livestock_logs WHERE status = 'LOST'",
        runner.getSchema(),
      );
      expect(errors.length).toBeGreaterThan(0);
      // Saran harus menunjuk kolom yang benar (sheep_name), bukan last_zone —
      // format suggestion adalah kalimat ramah "apakah maksudmu ...?".
      expect(errors.some((e) => e.suggestion?.includes('sheep_name'))).toBe(true);
      expect(errors.some((e) => e.suggestion?.includes('last_zone'))).toBe(false);
    } finally {
      runner.dispose();
    }
  });
});

describe('Q1 Bangun, Piko! — Bot Script end-to-end', () => {
  it('skrip solusi menggerakkan Piko ke petak matahari dan mengisi daya', async () => {
    const bot = new MockBot();
    const events: StepEvent[] = [];
    for await (const ev of runBotScript(
      'piko.boot();\npiko.moveForward(3);\npiko.charge();',
      bot.registry,
    )) {
      events.push(ev);
    }
    expect(events.at(-1)?.kind).toBe('done');
    expect(bot.booted).toBe(true);
    expect(bot.chargeLevel).toBe(100);
    // Target quest adalah sel (3,2); MockBot bergerak di sumbu x dari (0,·).
    expect(quest01BangunPiko.botWorldSetup!.targets).toContainEqual([3, 2]);
    expect(bot.position.x).toBe(3);
  });
});
