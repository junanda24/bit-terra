/**
 * UI/UX + CONTENT INTEGRITY AUDIT PROBES (read-only audit, 2026-10-22).
 * These tests do not gate the build — they generate machine-checked evidence
 * for the audit report: key closures, cartridge triangle, contrast ratios,
 * and the mobile width chain. Run: npx vitest run src/__audit__/ui.probe.test.ts
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { quest01BangunPiko } from '../content/quests/quest_01_bangun_piko';
import { quest02DombaTersesat } from '../content/quests/quest_02_domba_tersesat';
import { ALL_QUESTS } from '../content/quests/index';
import { Q1_Q2_DIALOGUES } from '../content/dialogues/q1_q2_dialogues';
import {
  CARTRIDGE_SNIPPETS,
  getCartridgeSnippet,
} from '../ui/hud/cartridgeSnippets';
import {
  botQuestVerdict,
  createBotStageState,
  type BotStageState,
} from '../ui/visualizer/botStageLogic';

const screenSrc = readFileSync('src/ui/cyberdeck/CyberDeckScreen.tsx', 'utf8');
const dialogueHelpersSrc = readFileSync('src/ui/cyberdeck/dialogueHelpers.ts', 'utf8');

/* ------------------------------------------------------------------ */
/* 1a. BOT reaction-key closure — exhaustive over the verdict's field  */
/* space through the REAL botQuestVerdict + REAL Q1 reaction data.    */
/* ------------------------------------------------------------------ */
describe('probe: bot reaction-key closure (Q1)', () => {
  it('enumerates every key botQuestVerdict can emit', () => {
    const base = createBotStageState(quest01BangunPiko.botWorldSetup!, [0, 2]);
    const emitted = new Set<string>();
    let successCount = 0;
    for (const awake of [false, true])
      for (const actedWhileAsleep of [false, true])
        for (const crashed of [false, true])
          for (const crashKind of [null, 'obstacle', 'bounds'] as const)
            for (const chargedDark of [false, true])
              for (const onTarget of [false, true])
                for (const charged of [false, true]) {
                  const s: BotStageState = {
                    ...base,
                    awake,
                    actedWhileAsleep,
                    crashed,
                    crashKind,
                    chargedDark,
                    onTarget,
                    charged,
                  };
                  const v = botQuestVerdict(s, quest01BangunPiko.onFailFunnyReactions);
                  if (v.kind === 'success') successCount++;
                  else emitted.add(v.reactionKey);
                }
    const defined = new Set(Object.keys(quest01BangunPiko.onFailFunnyReactions));
    const emittableButUndefined = [...emitted].filter((k) => !defined.has(k));
    const definedButNeverEmitted = [...defined].filter((k) => !emitted.has(k));
    console.log('BOT emitted keys:', [...emitted].sort().join(', '));
    console.log('BOT defined keys:', [...defined].sort().join(', '));
    console.log('BOT emittable-but-undefined:', JSON.stringify(emittableButUndefined));
    console.log('BOT defined-but-never-emitted (full field space):', JSON.stringify(definedButNeverEmitted));
    console.log('BOT success states in field space:', successCount);
    expect(emitted.size).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 1b. SQL reaction-key closure — static extraction of the picker in  */
/* CyberDeckScreen.finalizeSql + direct funnyFail calls, vs Q2 data.  */
/* ------------------------------------------------------------------ */
describe('probe: SQL reaction-key closure (Q2)', () => {
  it('extracts picker keys from source and compares with quest data', () => {
    const start = screenSrc.indexOf('const key =');
    const end = screenSrc.indexOf('funnyFail(key)', start);
    const pickerBlock = screenSrc.slice(start, end);
    const pickerKeys = new Set([...pickerBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    const directKeys = new Set(
      [...screenSrc.matchAll(/funnyFail\('([a-z_]+)'\)/g)].map((m) => m[1]),
    );
    const defined = new Set(Object.keys(quest02DombaTersesat.onFailFunnyReactions));
    console.log('SQL picker keys:', [...pickerKeys].sort().join(', '));
    console.log('SQL direct funnyFail keys:', [...directKeys].sort().join(', '));
    console.log('SQL defined keys:', [...defined].sort().join(', '));
    console.log(
      'SQL picker-keys-but-undefined:',
      JSON.stringify([...pickerKeys].filter((k) => !defined.has(k))),
    );
    console.log(
      'SQL defined-but-picker-never-picks:',
      JSON.stringify([...defined].filter((k) => !pickerKeys.has(k) && !directKeys.has(k))),
    );
    expect(pickerKeys.size).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 1c. Dialogue-phase closure: phases defined in data vs phases the   */
/* UI ever requests; hint reachability anchors in source.             */
/* ------------------------------------------------------------------ */
describe('probe: dialogue phase closure + hint reachability', () => {
  it('compares defined phases with requested phases', () => {
    const requested = new Set(
      [...screenSrc.matchAll(/getQuestDialogue\(quest\.id, '(\w+)'\)/g)].map((m) => m[1]),
    );
    console.log('Dialogue phases requested by UI:', [...requested].sort().join(', '));
    for (const [qid, script] of Object.entries(Q1_Q2_DIALOGUES)) {
      const defined = Object.keys(script ?? {});
      console.log(
        `${qid}: defined=${defined.sort().join(',')} unrequested=${defined
          .filter((p) => !requested.has(p))
          .sort()
          .join(',')}`,
      );
    }
    // Hint reachability anchors (the OTHER hint channel: quest.hints).
    console.log('UI renders a hint button:', screenSrc.includes('Minta Petunjuk'));
    console.log('Hint button cycles quest.hints:', screenSrc.includes('quest.hints[idx]'));
    console.log('Q1 hints in data:', quest01BangunPiko.hints.length, '| Q2 hints:', quest02DombaTersesat.hints.length);
    expect(requested.has('intro')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Cartridge triangle: unlocked <-> snippets <-> linter-allowed.  */
/* ------------------------------------------------------------------ */
describe('probe: cartridge triangle', () => {
  it('compares unlocked cartridges, snippet map, and BASE_BOT_FUNCTIONS', () => {
    const baseMatch = /const BASE_BOT_FUNCTIONS = \[([\s\S]*?)\];/.exec(screenSrc);
    const baseFns = new Set(
      [...(baseMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]),
    );
    console.log('BASE_BOT_FUNCTIONS (linter-allowed base):', [...baseFns].sort().join(', '));
    for (const quest of ALL_QUESTS) {
      const unlocked = quest.unlockedCartridges;
      const missingSnippet = unlocked.filter(
        (c) => !(c in CARTRIDGE_SNIPPETS) && getCartridgeSnippet(c) === `${c} `,
      );
      const snippetHeads = unlocked
        .map((c) => /^([A-Za-z]+(?:\.[A-Za-z]+)+)\s*\(/.exec(getCartridgeSnippet(c).trim())?.[1])
        .filter(Boolean) as string[];
      console.log(
        `${quest.id}: unlocked=[${unlocked.join(', ')}] missingSnippet=${JSON.stringify(missingSnippet)} snippetHeads=[${snippetHeads.join(', ')}]`,
      );
      if (quest.mode === 'BOT_SCRIPT') {
        const cartridgeFns = new Set(snippetHeads);
        const allowedNoCartridge = [...baseFns].filter((f) => !cartridgeFns.has(f));
        console.log(
          `${quest.id}: linter-allowed base functions WITHOUT a cartridge in this quest: ${allowedNoCartridge.join(', ')}`,
        );
      }
    }
    const snippetOnly = Object.keys(CARTRIDGE_SNIPPETS).filter(
      (k) => !ALL_QUESTS.some((q) => q.unlockedCartridges.includes(k)),
    );
    console.log('Snippet-map keys not unlocked by any Fase-1 quest:', snippetOnly.join(', '));
    expect(baseFns.size).toBeGreaterThan(0);
  });

  it('world-event humanize closure: every quest event code has a mapped sentence', () => {
    const mapBlock = /WORLD_EVENT_TEXT[^=]*= \{([\s\S]*?)\};/.exec(dialogueHelpersSrc);
    const mapped = new Set([...(mapBlock?.[1] ?? '').matchAll(/(\w+):/g)].map((m) => m[1]));
    for (const quest of ALL_QUESTS) {
      const unmapped = quest.onSuccessWorldEvents.filter((e) => !mapped.has(e));
      console.log(`${quest.id}: world events=[${quest.onSuccessWorldEvents.join(', ')}] unmapped=${JSON.stringify(unmapped)}`);
    }
    expect(mapped.size).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Contrast ratios (WCAG relative luminance) for the real pairs.   */
/* ------------------------------------------------------------------ */
function lum(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg: string, bg: string): number {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe('probe: contrast table', () => {
  it('prints ratios for every text/background pair used in scope', () => {
    const pairs: [string, string, string][] = [
      ['#ffb000', '#141820', 'amber on slate — titles/labels 12-15px'],
      ['#00f5d4', '#141820', 'mint on slate — mode labels, suggestions'],
      ['#d8ccb8', '#141820', 'bezel text on slate — body'],
      ['#ff4d6d', '#141820', 'coral on slate — FocusBar low number 12px bold'],
      ['#141820', '#ffb000', 'slate on amber — Ekspor Save, table header, name plate'],
      ['#fff7ea', '#c87d55', 'cream on copper — cartridge chip + PixelButton copper 13-15px bold'],
      ['#0b2b25', '#00f5d4', 'dark green on mint — cartridge chip'],
      ['#ffedd9', '#a85432', 'cream on wood — PixelButton wood 15px'],
      ['#eef7e6', '#4b724f', 'pale on moss — PixelButton moss (Minta Petunjuk) 15px'],
      ['#eef7ff', '#3b82a6', 'pale on river — cartridge chip'],
      ['#fff7ea', '#3b82a6', 'cream on river — Query SQL badge 12px bold'],
      ['#141820', '#f4b41b', 'slate on sun — chip, sticker, Misi selesai badge'],
      ['#ffb000', '#26303f', 'amber on slate-blue — PixelButton slate text'],
      ['#4a4234', '#d8ccb8', 'lamp state text on bezel — 9px Press Start 2P'],
      ['#7a6f59', '#d8ccb8', 'frame footnote + sticker placeholder on bezel — 11.5px'],
      ['#5d5142', '#d8ccb8', 'lever caption tarik tuasnya on bezel — 10.5px'],
      ['#8d99ab', '#141820', 'muted grey-blue on slate — Babak line, idle Piko 13px'],
      ['#8d99ab', '#10131a', 'muted on cartridge strip bg — empty-state 13px'],
      ['#54606f', '#10131a', 'editor gutter line numbers — 12px'],
      ['#54606f', '#0e1118', 'result-count footer — 11.5px mono'],
      ['#5b6b7f', '#141820', 'editor comments (they carry the player instructions in initialCode) - 14.5px italic'],
      ['#ffcf7d', '#141820', 'editor body text on slate — 14.5px mono'],
      ['#ffd489', '#141820', 'editor SQL identifiers on slate'],
      ['#f2ead6', '#0e1118', 'table cell text on dark row'],
      ['#26303f', '#fff7ea', 'Piko bubble text on cream'],
      ['#ffb3a7', '#141820', 'focus-low advice text — 13px'],
      ['#ff8fa5', '#2c1d28', 'Catatan Piko heading on coral-tinted panel'],
      ['#f2ead6', '#2c1d28', 'lint list text on coral-tinted panel'],
      ['#d8a84e', '#0b0e14', 'stage status label charged-dark (chip bg approximated)'],
      ['#7dffcb', '#0b0e14', 'stage status label active (chip bg approximated)'],
    ];
    for (const [fg, bg, label] of pairs) {
      const r = ratio(fg, bg);
      console.log(
        `CONTRAST ${fg} on ${bg} = ${r.toFixed(2)}:1 ${r < 4.5 ? 'FAIL(<4.5)' : 'pass'} — ${label}`,
      );
    }
    expect(pairs.length).toBeGreaterThan(20);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Mobile width chain at 360px — constants taken from the files:   */
/* CyberDeckScreen root p-4 (16x2); CyberDeckFrame p-3 (12x2) + 3px   */
/* borders (x2); screen row gap-3 (12) + right rail w-[86px]; screen  */
/* border 3px (x2); bot editor wrapper w-[38%] min-w-[240px].         */
/* ------------------------------------------------------------------ */
describe('probe: mobile width arithmetic (bot split view)', () => {
  it('computes usable stage width per viewport', () => {
    const chrome = 32 + 24 + 6 + 12 + 86 + 6; // = 166
    for (const vw of [320, 360, 390, 430, 480, 566, 768, 1024]) {
      const screen = vw - chrome;
      const editor = Math.max(screen * 0.38, 240);
      const stage = Math.max(0, screen - editor);
      console.log(
        `MOBILE vw=${vw}: screen=${screen}px editor=${Math.round(editor)}px stage=${stage}px clipped=${Math.max(0, editor - screen)}px`,
      );
    }
    const screen360 = 360 - chrome;
    expect(screen360).toBe(194);
    expect(Math.max(0, screen360 - 240)).toBe(0); // stage fully clipped at 360px
  });
});
