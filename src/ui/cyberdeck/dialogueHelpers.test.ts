import { describe, expect, it } from 'vitest';
import { humanizeWorldEvent, worldEventsSummary } from './dialogueHelpers';
import { getQuestDialogue } from '../../content/dialogues/q1_q2_dialogues';
import { quest01BangunPiko } from '../../content/quests/quest_01_bangun_piko';
import { quest02DombaTersesat } from '../../content/quests/quest_02_domba_tersesat';

describe('humanizeWorldEvent (F-03)', () => {
  it('event yang dikenal Q1/Q2 diterjemahkan ke kalimat desa', () => {
    expect(humanizeWorldEvent('PIKO_AWAKENS')).toContain('Piko bangun');
    expect(humanizeWorldEvent('SHEEP_RETURN')).toContain('pulang ke kandang');
  });

  it('event asing tetap terbaca rapi (fallback), bukan kode mentah', () => {
    expect(humanizeWorldEvent('GATE_OPENS_WIDE')).toBe('Gate opens wide');
  });

  it('semua onSuccessWorldEvents Q1+Q2 punya terjemahan manusiawi', () => {
    for (const quest of [quest01BangunPiko, quest02DombaTersesat]) {
      for (const ev of quest.onSuccessWorldEvents) {
        expect(humanizeWorldEvent(ev)).not.toContain('_');
      }
    }
    expect(worldEventsSummary(quest02DombaTersesat.onSuccessWorldEvents)).toContain('·');
  });
});

describe('getQuestDialogue(questId, phase) (F-03)', () => {
  it('intro, success, dan funnyFail Q1/Q2 semuanya terisi', () => {
    for (const id of [quest01BangunPiko.id, quest02DombaTersesat.id]) {
      expect(getQuestDialogue(id, 'intro')?.length).toBeGreaterThan(0);
      expect(getQuestDialogue(id, 'success')?.length).toBeGreaterThan(0);
      expect(getQuestDialogue(id, 'funnyFail')?.length).toBeGreaterThan(0);
    }
  });

  it('momen emosional Q2 utuh: Pak Rani menyebut nama ketiga dombanya', () => {
    const success = getQuestDialogue(quest02DombaTersesat.id, 'success') ?? [];
    const joined = success.map((l) => l.text).join(' ');
    expect(joined).toContain('Kriting');
    expect(joined).toContain('Bolang');
    expect(joined).toContain('Brintik');
  });

  it('quest tak dikenal → undefined, bukan error', () => {
    expect(getQuestDialogue('quest_99_tidak_ada', 'intro')).toBeUndefined();
  });
});
