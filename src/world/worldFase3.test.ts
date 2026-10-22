import { describe, expect, it, vi } from 'vitest';

// textures.ts mengimpor Phaser sebagai nilai (dipakai hanya di posisi
// tipe); ESM Phaser menyentuh `window` saat init — stub agar tes logika
// ini bisa jalan di node tanpa DOM.
vi.mock('phaser', () => ({ default: {} }));

import { OBJECT_TEXTURES } from './textureSpec';
import { OBJECT_PAINTERS } from './textures';
import { getWorldDialogue } from './npcDialogues';
import { deriveWorldState } from './worldState';

const Q3 = 'quest_03_pintu_air';
const Q5 = 'quest_05_konveyor_roti';
const Q7 = 'quest_07_jembatan_kristal';

describe('deriveWorldState — perbaikan Fase 3 (Q3/Q5/Q7)', () => {
  it('tanpa quest selesai: semua bendera Fase 3 mati', () => {
    const s = deriveWorldState([]);
    expect(s.sluiceFlowing).toBe(false);
    expect(s.fieldGreen).toBe(false);
    expect(s.conveyorRunning).toBe(false);
    expect(s.mazeRootsReceded).toBe(false);
  });

  it('Q3 selesai → pintu air mengalir, ladang menghijau, area sluice terdaftar', () => {
    const s = deriveWorldState([Q3]);
    expect(s.sluiceFlowing).toBe(true);
    expect(s.fieldGreen).toBe(true);
    expect(s.repairedAreas).toContain('sluice');
    expect(s.conveyorRunning).toBe(false);
    expect(s.mazeRootsReceded).toBe(false);
  });

  it('Q5 selesai → ban berjalan menyala & area conveyor_shed terdaftar', () => {
    const s = deriveWorldState([Q5]);
    expect(s.conveyorRunning).toBe(true);
    expect(s.repairedAreas).toContain('conveyor_shed');
    expect(s.sluiceFlowing).toBe(false);
  });

  it('Q7 selesai → akar labirin minggir & area root_maze terdaftar', () => {
    const s = deriveWorldState([Q7]);
    expect(s.mazeRootsReceded).toBe(true);
    expect(s.repairedAreas).toContain('root_maze');
  });

  it('ketiganya selesai → semua bendera Fase 3 menyala sekaligus', () => {
    const s = deriveWorldState([Q3, Q5, Q7]);
    expect(s.sluiceFlowing && s.fieldGreen && s.conveyorRunning && s.mazeRootsReceded).toBe(
      true,
    );
  });
});

describe('dialog dunia untuk anchor Fase 3 sadar progres', () => {
  it('sluice/conveyor/root_maze berubah setelah quest-nya selesai', () => {
    const pairs: [string, string][] = [
      ['sluice', Q3],
      ['conveyor', Q5],
      ['root_maze', Q7],
    ];
    for (const [dialogueId, questId] of pairs) {
      const before = getWorldDialogue(dialogueId, []);
      const after = getWorldDialogue(dialogueId, [questId]);
      expect(before?.lines.length, dialogueId).toBeGreaterThan(0);
      expect(after?.lines.length, dialogueId).toBeGreaterThan(0);
      expect(after).not.toEqual(before);
    }
  });
});

describe('tekstur keadaan-perbaikan Fase 3', () => {
  it('setiap tekstur objek di katalog punya pelukisnya (tidak ada yang bisu)', () => {
    for (const key of Object.keys(OBJECT_TEXTURES)) {
      expect(OBJECT_PAINTERS[key], `painter untuk ${key}`).toBeTypeOf('function');
    }
  });

  it('tekstur perbaikan Q3/Q5/Q7 terdaftar 64x64', () => {
    for (const key of ['obj_sluice_flow', 'obj_shed_lit', 'obj_root_arch_open']) {
      expect(OBJECT_TEXTURES[key], key).toEqual({ w: 64, h: 64 });
    }
  });
});
