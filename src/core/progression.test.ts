/**
 * Tes helper progresi berurutan (Fase 3) — termasuk kasus save lama:
 * progres yang dibuat sebelum ada sistem kunci harus mendarat dengan
 * benar (Q1+Q2 selesai → Q3 terbuka, Q4+ terkunci).
 */
import { describe, expect, it } from 'vitest';
import {
  isQuestUnlocked,
  lockBlockerId,
  nextQuestId,
  questOrderIndex,
} from './progression';
import { ALL_QUESTS } from '../content/quests/index';
import { VILLAGE_QUEST_ORDER } from '../world/worldState';

const CHAIN = [
  'quest_01_bangun_piko',
  'quest_02_domba_tersesat',
  'quest_03_pintu_air',
  'quest_04_urutan_panen',
  'quest_05_konveyor_roti',
  'quest_06_kas_festival',
  'quest_07_jembatan_kristal',
  'quest_08_great_commit',
] as const;
const [Q1, Q2, Q3, Q4, Q5, Q6, , Q8] = CHAIN;

describe('progresi berurutan', () => {
  it('tanpa progres: hanya quest pertama yang terbuka', () => {
    expect(isQuestUnlocked(Q1, CHAIN, [])).toBe(true);
    for (const id of CHAIN.slice(1)) {
      expect(isQuestUnlocked(id, CHAIN, []), id).toBe(false);
    }
    expect(nextQuestId(CHAIN, [])).toBe(Q1);
  });

  it('menyelesaikan satu quest membuka persis quest berikutnya', () => {
    const done = [Q1];
    expect(isQuestUnlocked(Q2, CHAIN, done)).toBe(true);
    expect(isQuestUnlocked(Q3, CHAIN, done)).toBe(false);
    expect(lockBlockerId(Q3, CHAIN, done)).toBe(Q2);
    expect(lockBlockerId(Q8, CHAIN, done)).toBe(Q2);
    expect(nextQuestId(CHAIN, done)).toBe(Q2);
  });

  it('penghalang selalu quest belum selesai yang PALING AWAL', () => {
    const done = [Q1, Q2, Q3];
    expect(lockBlockerId(Q6, CHAIN, done)).toBe(Q4);
    expect(lockBlockerId(Q4, CHAIN, done)).toBeNull();
    expect(nextQuestId(CHAIN, done)).toBe(Q4);
  });

  it('quest yang sudah selesai selalu bisa dimainkan ulang, walau save-nya aneh', () => {
    // Save rusak/parsial: Q5 tercatat selesai tanpa pendahulunya. Ia tetap
    // bisa dibuka lagi (hak pemain), tapi rantai ke Q6 tetap menuntut Q1.
    const done = [Q5];
    expect(isQuestUnlocked(Q5, CHAIN, done)).toBe(true);
    expect(isQuestUnlocked(Q6, CHAIN, done)).toBe(false);
    expect(lockBlockerId(Q6, CHAIN, done)).toBe(Q1);
  });

  it('save lama (dibuat sebelum sistem kunci): Q1+Q2 selesai → Q3 terbuka, sisanya terkunci', () => {
    const legacy = [Q1, Q2];
    expect(isQuestUnlocked(Q3, CHAIN, legacy)).toBe(true);
    expect(isQuestUnlocked(Q4, CHAIN, legacy)).toBe(false);
    expect(lockBlockerId(Q4, CHAIN, legacy)).toBe(Q3);
    expect(isQuestUnlocked(Q1, CHAIN, legacy)).toBe(true); // main ulang
    expect(isQuestUnlocked(Q2, CHAIN, legacy)).toBe(true); // main ulang
    expect(nextQuestId(CHAIN, legacy)).toBe(Q3);
  });

  it('semua selesai: semua terbuka, tidak ada quest berikutnya', () => {
    expect(nextQuestId(CHAIN, [...CHAIN])).toBeNull();
    for (const id of CHAIN) {
      expect(isQuestUnlocked(id, CHAIN, [...CHAIN])).toBe(true);
      expect(lockBlockerId(id, CHAIN, [...CHAIN])).toBeNull();
    }
  });

  it('quest di luar rantai tidak diatur helper ini', () => {
    expect(questOrderIndex(CHAIN, 'quest_eksperimen')).toBe(-1);
    expect(isQuestUnlocked('quest_eksperimen', CHAIN, [])).toBe(true);
    expect(lockBlockerId('quest_eksperimen', CHAIN, [])).toBeNull();
  });

  it('rantai kosong / progres kosong tidak meledak', () => {
    expect(nextQuestId([], [])).toBeNull();
    expect(isQuestUnlocked(Q1, [], [])).toBe(true);
  });
});

describe('konsistensi rantai desa vs indeks konten', () => {
  it('urutan relatif quest di ALL_QUESTS selaras dengan VILLAGE_QUEST_ORDER', () => {
    // Penjaga integrasi Fase 3 (dua agent menulis konten terpisah): quest
    // yang hadir di indeks konten harus muncul dalam urutan relatif yang
    // sama dengan rantai kanonik desa — kalau tidak, kunci progres dan
    // petunjuk HUD akan menunjuk quest yang berbeda.
    const inContent = VILLAGE_QUEST_ORDER.filter((id) =>
      ALL_QUESTS.some((q) => q.id === id),
    );
    const contentOrder = ALL_QUESTS.map((q) => q.id).filter((id) =>
      VILLAGE_QUEST_ORDER.includes(id),
    );
    expect(contentOrder).toEqual(inContent);
  });

  it('setiap quest terbit dikenal rantai desa', () => {
    for (const quest of ALL_QUESTS) {
      expect(VILLAGE_QUEST_ORDER, quest.id).toContain(quest.id);
    }
  });
});
