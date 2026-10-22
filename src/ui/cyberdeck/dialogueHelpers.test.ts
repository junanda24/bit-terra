import { describe, expect, it } from 'vitest';
import { humanizeWorldEvent, summarizeLintErrors, worldEventsSummary } from './dialogueHelpers';
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

describe('summarizeLintErrors — blanko digabung (audit layout F)', () => {
  const blank = (line: number) => ({
    line,
    code: 'blank',
    message: 'Masih ada bagian kosong (___) di baris ini.',
    suggestion: 'Klik cartridge di atas editor untuk mengisinya.',
  });

  it('dua blanko (baris 10 & 13, kasus nyata Q1) jadi SATU baris ringkasan', () => {
    const items = summarizeLintErrors([blank(10), blank(13)]);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Baris 10 & 13 masih ada bagian kosong (___).');
    expect(items[0].suggestion).toContain('cartridge');
  });

  it('satu blanko: kalimat tunggal; tiga blanko: daftar koma + &', () => {
    expect(summarizeLintErrors([blank(4)])[0].text).toBe(
      'Baris 4 masih ada bagian kosong (___).',
    );
    expect(summarizeLintErrors([blank(9), blank(2), blank(5)])[0].text).toBe(
      'Baris 2, 5 & 9 masih ada bagian kosong (___).',
    );
  });

  it('error lain tetap tampil dengan prefix Baris; total dibatasi 3', () => {
    const items = summarizeLintErrors([
      blank(10),
      { line: 3, message: 'Piko belum punya modul x.' },
      { line: 7, message: 'Lainnya.', suggestion: 'Saran.' },
      { line: 9, message: 'Keempat.' },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0].text).toContain('bagian kosong');
    expect(items[1].text).toBe('Baris 3: Piko belum punya modul x.');
    expect(items[2].suggestion).toBe('Saran.');
  });

  it('tanpa blanko & tanpa error: kosong', () => {
    expect(summarizeLintErrors([])).toEqual([]);
  });
});
