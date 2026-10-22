/**
 * Tes logika toast WORLD_REPAIR (Fase 4): kelengkapan pemetaan terhadap
 * repairedAreas yang benar-benar diterbitkan deriveWorldState, suara
 * hangat tanpa emoji, dan perilaku antrean (FIFO + dedupe).
 */
import { describe, expect, it } from 'vitest';
import { deriveWorldState } from '../../world/worldState';
import { ALL_QUESTS } from '../../content/quests/index';
import { enqueueRepair, repairToastInfo } from './repairToast';

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

describe('repairToastInfo', () => {
  it('setiap area yang bisa diterbitkan deriveWorldState punya judul & baris Piko', () => {
    const allDone = deriveWorldState(ALL_QUESTS.map((q) => q.id));
    expect(allDone.repairedAreas.length).toBeGreaterThanOrEqual(6);
    for (const area of allDone.repairedAreas) {
      const info = repairToastInfo(area);
      expect(info.title.length).toBeGreaterThan(3);
      expect(info.pikoLine.length).toBeGreaterThan(10);
      // Judul bukan kode mentah yang gagal diterjemahkan (mis. "Workshop").
      expect(info.title).not.toBe(area);
      expect(info.title).not.toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('judul memakai ulang kalimat manusiawi WORLD_EVENT_TEXT', () => {
    expect(repairToastInfo('workshop').title).toBe('Lampu bengkel menyala lagi');
    expect(repairToastInfo('sheep_pen').title).toBe(
      'Domba-domba berlari pulang ke kandang',
    );
    expect(repairToastInfo('mother_tree').title).toBe(
      'Pohon Induk berbunga lagi di tengah desa',
    );
  });

  it('tidak ada emoji di judul maupun baris Piko mana pun', () => {
    const allDone = deriveWorldState(ALL_QUESTS.map((q) => q.id));
    for (const area of [...allDone.repairedAreas, 'wilayah_asing']) {
      const info = repairToastInfo(area);
      expect(info.title).not.toMatch(EMOJI_RE);
      expect(info.pikoLine).not.toMatch(EMOJI_RE);
    }
  });

  it('area asing mendapat fallback sopan, bukan crash atau string kosong', () => {
    const info = repairToastInfo('menara_jam');
    expect(info.title).toBe('Menara jam');
    expect(info.pikoLine.length).toBeGreaterThan(10);
  });
});

describe('enqueueRepair', () => {
  it('menjaga urutan FIFO', () => {
    let q: string[] = [];
    q = enqueueRepair(q, 'workshop');
    q = enqueueRepair(q, 'sheep_pen');
    q = enqueueRepair(q, 'sluice');
    expect(q).toEqual(['workshop', 'sheep_pen', 'sluice']);
  });

  it('area yang sama tidak diantrekan dua kali', () => {
    let q: string[] = [];
    q = enqueueRepair(q, 'workshop');
    q = enqueueRepair(q, 'workshop');
    expect(q).toEqual(['workshop']);
  });

  it('tidak memutasi antrean asal', () => {
    const before = ['workshop'];
    const after = enqueueRepair(before, 'sluice');
    expect(before).toEqual(['workshop']);
    expect(after).toEqual(['workshop', 'sluice']);
  });
});
