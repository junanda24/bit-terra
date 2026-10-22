/**
 * Tes logika dunia Fase 2 — murni node, tanpa canvas/Phaser.
 *
 * Yang dibuktikan di sini:
 *  - Data peta konsisten (dimensi baris, spawn bisa diinjak).
 *  - Dari spawn, flood fill mencapai ubin tetangga SETIAP interactable
 *    (pemain benar-benar bisa menghampiri semua titik penting), dalam
 *    kedua keadaan gerbang kandang.
 *  - deriveWorldState memetakan progres -> keadaan desa dengan benar.
 *  - Registri interaksi lengkap terhadap indeks konten: quest yang sudah
 *    terbit punya anchor 'quest'; quest Fase 3 punya anchor 'flavor'.
 *  - Registri tekstur konsisten: setiap karakter tanah punya tekstur,
 *    setiap objek peta memakai tekstur terdaftar, seni karakter utuh
 *    (16 kolom per baris, semua karakter seni ada di palet).
 *  - Nama domba di dunia sama dengan nama di data Q2.
 */
import { describe, expect, it } from 'vitest';
import {
  FUTURE_QUEST_IDS,
  GROUND_ROWS,
  GROUND_TEXTURE,
  INTERACTABLES,
  MAP_COLS,
  MAP_OBJECTS,
  MAP_ROWS,
  NPCS,
  PLAYER_SPAWN,
  SHEEP,
  adjacentWalkable,
  buildWalkGrid,
  floodReachable,
  groundAt,
  objectSolidTiles,
} from './mapData';
import {
  CHARACTER_SPECS,
  FRAME_DIRECTIONS,
  OBJECT_TEXTURES,
  TILE_TEXTURES,
} from './textureSpec';
import {
  deriveWorldState,
  getObjectiveHint,
  newlyRepairedAreas,
  sheepTile,
} from './worldState';
import { getWorldDialogue } from './npcDialogues';
import { ALL_QUESTS } from '../content/quests/index';
import { quest02DombaTersesat } from '../content/quests/quest_02_domba_tersesat';

const Q1 = 'quest_01_bangun_piko';
const Q2 = 'quest_02_domba_tersesat';
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

describe('data peta', () => {
  it('semua baris tanah punya lebar MAP_COLS dan jumlahnya MAP_ROWS', () => {
    expect(GROUND_ROWS).toHaveLength(MAP_ROWS);
    for (const row of GROUND_ROWS) expect(row).toHaveLength(MAP_COLS);
  });

  it('setiap karakter tanah terpakai punya tekstur terdaftar', () => {
    const used = new Set(GROUND_ROWS.join('').split(''));
    for (const ch of used) {
      const key = GROUND_TEXTURE[ch as keyof typeof GROUND_TEXTURE];
      expect(key, `karakter tanah '${ch}'`).toBeTruthy();
      expect(TILE_TEXTURES[key], `tekstur ubin ${key}`).toBeTruthy();
    }
  });

  it('setiap objek peta memakai tekstur objek terdaftar dan ubin padatnya di dalam/samping peta', () => {
    for (const o of MAP_OBJECTS) {
      expect(OBJECT_TEXTURES[o.texture], `objek ${o.id}`).toBeTruthy();
      for (const [x, y] of objectSolidTiles(o)) {
        expect(x, `${o.id} x`).toBeGreaterThanOrEqual(-2);
        expect(y, `${o.id} y`).toBeGreaterThanOrEqual(-2);
        expect(x, `${o.id} x`).toBeLessThan(MAP_COLS);
        expect(y, `${o.id} y`).toBeLessThan(MAP_ROWS);
      }
    }
  });

  it('ubin spawn bisa diinjak', () => {
    const grid = buildWalkGrid(false);
    expect(grid[PLAYER_SPAWN.y][PLAYER_SPAWN.x]).toBe(true);
    expect(groundAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y)).toBe('.');
  });
});

describe('jangkauan flood fill dari spawn', () => {
  for (const gateClosed of [false, true]) {
    it(`setiap interactable punya tetangga terjangkau (gerbang ${gateClosed ? 'tertutup' : 'terbuka'})`, () => {
      const grid = buildWalkGrid(gateClosed);
      const reachable = floodReachable(grid, PLAYER_SPAWN.x, PLAYER_SPAWN.y);
      for (const it of INTERACTABLES) {
        const neighbours = adjacentWalkable(grid, it.tileX, it.tileY);
        const ok = neighbours.some(([x, y]) => reachable.has(`${x},${y}`));
        expect(ok, `interactable ${it.id} di (${it.tileX},${it.tileY})`).toBe(true);
      }
    });
  }

  it('jembatan menyeberangkan pemain ke plaza festival', () => {
    const grid = buildWalkGrid(false);
    const reachable = floodReachable(grid, PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    expect(reachable.has('20,28')).toBe(true); // tengah plaza festival
    expect(reachable.has('31,26')).toBe(true); // depan gudang konveyor
    expect(reachable.has('38,2')).toBe(true); // gerbang akar
  });

  it('ladang, kebun, dan dalam bengkel terjangkau', () => {
    const grid = buildWalkGrid(false);
    const reachable = floodReachable(grid, PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    expect(reachable.has('5,6')).toBe(true); // dalam bengkel
    expect(reachable.has('6,16')).toBe(true); // kebun Bibi Flora
    expect(reachable.has('32,15')).toBe(false); // orang-orangan sawah itu padat
    expect(reachable.has('31,15')).toBe(true); // di sampingnya bisa
    expect(reachable.has('30,5')).toBe(true); // dalam kandang (gerbang terbuka)
  });
});

describe('deriveWorldState', () => {
  it('tanpa progres: desa masih rusak', () => {
    const s = deriveWorldState([]);
    expect(s).toEqual({
      workshopLampOn: false,
      pikoAwake: false,
      penGateClosed: false,
      sheepHome: false,
      repairedAreas: [],
    });
  });

  it('Q1 selesai: lampu menyala + Piko bangun, kandang belum berubah', () => {
    const s = deriveWorldState([Q1]);
    expect(s.workshopLampOn).toBe(true);
    expect(s.pikoAwake).toBe(true);
    expect(s.penGateClosed).toBe(false);
    expect(s.sheepHome).toBe(false);
    expect(s.repairedAreas).toEqual(['workshop']);
  });

  it('Q1+Q2 selesai: semua pulih berurutan area', () => {
    const s = deriveWorldState([Q1, Q2]);
    expect(s).toEqual({
      workshopLampOn: true,
      pikoAwake: true,
      penGateClosed: true,
      sheepHome: true,
      repairedAreas: ['workshop', 'sheep_pen'],
    });
  });

  it('Q2 saja (urutan bebas): kandang pulih, Piko tetap tidur', () => {
    const s = deriveWorldState([Q2]);
    expect(s.pikoAwake).toBe(false);
    expect(s.sheepHome).toBe(true);
    expect(s.repairedAreas).toEqual(['sheep_pen']);
  });

  it('newlyRepairedAreas hanya melaporkan yang baru', () => {
    const a = deriveWorldState([]);
    const b = deriveWorldState([Q1]);
    const c = deriveWorldState([Q1, Q2]);
    expect(newlyRepairedAreas(a, b)).toEqual(['workshop']);
    expect(newlyRepairedAreas(b, c)).toEqual(['sheep_pen']);
    expect(newlyRepairedAreas(c, c)).toEqual([]);
  });
});

describe('domba dunia vs data Q2', () => {
  it('tiga domba dunia persis tiga nama LOST di expectedSqlResult Q2', () => {
    const expectedNames = (quest02DombaTersesat.expectedSqlResult ?? []).map(
      (row) => row.sheep_name,
    );
    expect([...expectedNames].sort()).toEqual(SHEEP.map((s) => s.name).sort());
  });

  it('posisi domba: tersesat di zona data Q2, pulang ke kandang setelah Q2', () => {
    const lost = deriveWorldState([]);
    const home = deriveWorldState([Q2]);
    // Kriting: Tepi Sungai; Bolang: Dekat Bendungan (pintu air); Brintik: Kebun Bibi Flora.
    expect(sheepTile(lost, 'Kriting')).toMatchObject({ x: 24, y: 21 });
    expect(sheepTile(lost, 'Bolang')).toMatchObject({ x: 14, y: 21 });
    expect(sheepTile(lost, 'Brintik')).toMatchObject({ x: 8, y: 17 });
    for (const s of SHEEP) {
      const pos = sheepTile(home, s.name);
      expect(pos).not.toBeNull();
      expect(pos!.x).toBeGreaterThanOrEqual(29);
      expect(pos!.x).toBeLessThanOrEqual(37);
      expect(pos!.y).toBeGreaterThanOrEqual(3);
      expect(pos!.y).toBeLessThanOrEqual(9);
    }
    expect(sheepTile(home, 'Domba Fiktif')).toBeNull();
  });
});

describe('registri interaksi vs indeks konten', () => {
  it('setiap quest terbit punya tepat satu anchor quest', () => {
    for (const quest of ALL_QUESTS) {
      const anchors = INTERACTABLES.filter(
        (i) => i.kind === 'quest' && i.questId === quest.id,
      );
      expect(anchors, quest.id).toHaveLength(1);
    }
  });

  it('setiap quest Fase 3 punya anchor flavor', () => {
    for (const id of FUTURE_QUEST_IDS) {
      const anchors = INTERACTABLES.filter(
        (i) => i.kind === 'flavor' && i.futureQuestId === id,
      );
      expect(anchors, id).toHaveLength(1);
    }
  });

  it('anchor quest menunjuk quest yang benar-benar ada', () => {
    const ids = new Set(ALL_QUESTS.map((q) => q.id));
    for (const i of INTERACTABLES) {
      if (i.kind === 'quest') expect(ids.has(i.questId ?? '')).toBe(true);
    }
  });

  it('NPC di peta dan NPC penutur dialog selaras', () => {
    for (const npc of NPCS) {
      const anchor = INTERACTABLES.find((i) => i.id === npc.id);
      expect(anchor, npc.id).toBeTruthy();
      expect(anchor!.tileX).toBe(npc.tileX);
      expect(anchor!.tileY).toBe(npc.tileY);
    }
  });

  it('semua dialogId interactable punya dialog dunia; semua prompt bebas emoji', () => {
    for (const i of INTERACTABLES) {
      expect(i.prompt).not.toMatch(EMOJI_RE);
      const dlgId = i.kind === 'quest' ? i.doneDialogueId : i.dialogueId;
      if (dlgId) {
        const dlg = getWorldDialogue(dlgId, []);
        expect(dlg, `${i.id} -> ${dlgId}`).not.toBeNull();
        expect(dlg!.lines.length).toBeGreaterThan(0);
        for (const line of dlg!.lines) expect(line).not.toMatch(EMOJI_RE);
      }
    }
  });
});

describe('spesifikasi tekstur karakter', () => {
  it('setiap karakter: 3 tampak x 16 baris x 16 kolom, kaki 3 varian x 4 baris', () => {
    for (const spec of Object.values(CHARACTER_SPECS)) {
      for (const view of FRAME_DIRECTIONS) {
        const rows = spec.views[view];
        expect(rows, `${spec.key}/${view}`).toHaveLength(16);
        for (const row of rows) expect(row).toHaveLength(16);
      }
      for (const legs of [spec.legs.stand, spec.legs.stepA, spec.legs.stepB]) {
        expect(legs).toHaveLength(4);
        for (const row of legs) expect(row).toHaveLength(16);
      }
    }
  });

  it('setiap karakter seni (selain transparan) ada di palet karakternya', () => {
    for (const spec of Object.values(CHARACTER_SPECS)) {
      const used = new Set<string>();
      for (const view of FRAME_DIRECTIONS) {
        for (const row of spec.views[view]) for (const ch of row) used.add(ch);
      }
      for (const legs of [spec.legs.stand, spec.legs.stepA, spec.legs.stepB]) {
        for (const row of legs) for (const ch of row) used.add(ch);
      }
      for (const ch of used) {
        if (ch === '.') continue;
        expect(spec.palette[ch], `${spec.key} karakter '${ch}'`).toBeTruthy();
      }
    }
  });

  it('NPC dunia memakai kunci karakter yang terdaftar', () => {
    for (const npc of NPCS) {
      expect(CHARACTER_SPECS[npc.character], npc.id).toBeTruthy();
    }
    expect(CHARACTER_SPECS.player).toBeTruthy();
  });
});

describe('petunjuk tujuan HUD', () => {
  it('berubah mengikuti progres dan bebas emoji', () => {
    const awal = getObjectiveHint([]);
    const tengah = getObjectiveHint([Q1]);
    const akhir = getObjectiveHint([Q1, Q2]);
    expect(awal).toContain('Bengkel');
    expect(tengah).toContain('Pak Rani');
    expect(akhir).toContain('pulih');
    for (const hint of [awal, tengah, akhir]) expect(hint).not.toMatch(EMOJI_RE);
  });
});
