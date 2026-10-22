/**
 * Data peta Desa Bit-Terra (Fase 2) — murni data + logika grid, TANPA Phaser.
 *
 * Peta digambar tangan sebagai string ubin 40x30. Lapisan:
 *  1. GROUND_ROWS: medan dasar per ubin (rumput, jalan, air, tanah ladang...).
 *  2. MAP_OBJECTS: bangunan/pohon/pagar/objek di atas ubin, masing-masing
 *     menyatakan ubin mana yang padat (solid).
 *  3. INTERACTABLES: titik interaksi data-driven (anchor quest, NPC, papan,
 *     dan jangkar rasa untuk quest Fase 3).
 *
 * Aturan grid dibuktikan tes: dari titik spawn, flood fill harus mencapai
 * ubin tetangga setiap interactable (docs: world.test.ts).
 */
import { TILE_SIZE } from './textureSpec';

export const MAP_COLS = 40;
export const MAP_ROWS = 30;
export { TILE_SIZE };
export const WORLD_W = MAP_COLS * TILE_SIZE;
export const WORLD_H = MAP_ROWS * TILE_SIZE;

export type GroundChar =
  | 'G' // rumput
  | '.' // jalan tanah
  | '~' // air sungai
  | 'B' // jembatan papan (di atas air, bisa dilewati)
  | 'S' // tanah ladang gembur
  | 'C' // baris tanaman (tidak bisa diinjak)
  | 'F' // petak bunga kebun
  | 'P' // plaza batu
  | 'D' // tanah kandang
  | 'W'; // lantai papan bengkel

/** Karakter tanah -> kunci tekstur (textureSpec.TILE_TEXTURES). */
export const GROUND_TEXTURE: Record<GroundChar, string> = {
  G: 'tex_grass',
  '.': 'tex_path',
  '~': 'tex_water',
  B: 'tex_bridge',
  S: 'tex_soil',
  C: 'tex_crops',
  F: 'tex_flowerbed',
  P: 'tex_plaza',
  D: 'tex_pen',
  W: 'tex_planks',
};

/** Tanah yang tidak bisa diinjak secara bawaan (air; tanaman). */
const IMPASSABLE_GROUND: ReadonlySet<GroundChar> = new Set(['~', 'C']);

// 40 kolom x 30 baris. Lihat catatan wilayah di header berkas konsep:
// bengkel barat (x2-8,y3-9), plaza Pohon Induk utara-tengah (x16-23,y3-6),
// kandang timur (x29-37,y3-9), kebun barat-daya (x2-10,y14-20),
// ladang tenggara (x28-37,y13-18), sungai selatan (y23-25) + jembatan
// x19-20, plaza festival selatan-tengah (x16-24,y27-29).
export const GROUND_ROWS: string[] = [
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // y0
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // y1
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // y2
  'GGGGGGGGGGGGGGGGPPPPPPPPGGGGGDDDDDDDDGGG', // y3
  'GGWWWWWWWGGGGGGGPPPPPPPPGGGGGDDDDDDDDGGG', // y4
  'GGWWWWWWWGGGGGGGPPPPPPPPGGGGGDDDDDDDDGGG', // y5
  'GGWWWWWWWGGGGGGGPPPPPPPP....DDDDDDDDDGGG', // y6
  'GGWWWWWWWGGGGGGGGGG..GGGGGGGGDDDDDDDDGGG', // y7
  'GGWWWWWWWGGGGGGGGGG..GGGGGGGGDDDDDDDDGGG', // y8
  'GGWWWWWWWGGGGGGGGGG..GGGGGGGGDDDDDDDDGGG', // y9
  'GG.......GGGGGGGGGG..GGGGGGGGGGGGGGGGGGG', // y10
  '........................................', // y11
  'GGGGGGGGGGGGGGGGGGG..GGGGGG.GGGGGGGGGGGG', // y12
  'GGFFFFFFFFFGGGGGGGG..GGGGGG.SSSSSSSSSSGG', // y13
  'GGFFFFFFFFFGGGGGGGG..GGGGGG.CCCCCCCCCCGG', // y14
  'GGFFFFFFFFFGGGGGGGG..GGGGGG.SSSSSSSSSSGG', // y15
  'GGFFFFFFFFFGGGGGGGG..GGGGGG.CCCCCCCCCCGG', // y16
  'GGFFFFFFFFFGGGGGGGG..GGGGGG.SSSSSSSSSSGG', // y17
  'GGFFFFFFFFFGGGGGGGG..GGGGGG.CCCCCCCCCCGG', // y18
  'GGFFFFFFFFFGGGGGGGG..GGGGGGGGGGGGGGGGGGG', // y19
  'GGFFFFFFFFFGGGGGGGG..GGGGGGGGGGGGGGGGGGG', // y20
  'GGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGG', // y21
  'GGGGGGGGGGGGGGGGGGG..GGGGGGGGGGGGGGGGGGG', // y22
  '~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~~~~', // y23
  '~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~~~~', // y24
  '~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~~~~', // y25
  '........................................', // y26
  'GGGGGGGGGGGGGGGGPPPPPPPPPGGGGGGGGGGGGGGG', // y27
  'GGGGGGGGGGGGGGGGPPPPPPPPPGGGGGGGGGGGGGGG', // y28
  'GGGGGGGGGGGGGGGGPPPPPPPPPGGGGGGGGGGGGGGG', // y29
];

/** Titik spawn pemain: halaman depan bengkel warisan Kakek. */
export const PLAYER_SPAWN = { x: 5, y: 10 } as const;

// ---------------------------------------------------------------- objek

export interface MapObject {
  id: string;
  texture: string;
  /** Ubin kiri-atas tempat sprite ditambatkan. */
  tileX: number;
  tileY: number;
  /** Ukuran sprite dalam ubin. */
  tilesW: number;
  tilesH: number;
  /** Ubin yang padat; 'all' = semua ubin yang ditutupi sprite. */
  solid: [number, number][] | 'all';
  /** Lapisan gambar: 'ground' menempel tanah, 'sorted' ikut urutan-y, 'above' selalu di atas pemain. */
  layer: 'ground' | 'sorted' | 'above';
  /** Hanya untuk pintu kandang: padat hanya saat gerbang tertutup. */
  solidWhenGateClosed?: boolean;
}

function obj(
  partial: Omit<MapObject, 'tilesW' | 'tilesH' | 'solid' | 'layer'> &
    Partial<Pick<MapObject, 'tilesW' | 'tilesH' | 'solid' | 'layer'>>,
): MapObject {
  return { tilesW: 1, tilesH: 1, solid: 'all', layer: 'sorted', ...partial };
}

const TREES: [number, number][] = [
  [0, 1], [4, 0], [9, 1], [13, 0], [25, 1], [31, 0], [34, 0],
  [1, 12], [14, 13], [24, 12], [12, 20], [33, 21], [5, 22],
  [26, 22], [2, 27], [10, 28], [37, 28], [15, 21], [35, 19],
];

const FENCES: MapObject[] = [
  // Kandang domba Pak Rani: pagar keliling x28-37, y2-10; gerbang di (28,6).
  // (Sisi timur laut sengaja berhenti di x36 — celah rumput menuju Gerbang
  // Akar di (38,0) supaya jangkar Labirin Akar selalu terjangkau, termasuk
  // setelah gerbang kandang tertutup.)
  ...Array.from({ length: 8 }, (_, i) =>
    obj({ id: `fence_pen_top_${i}`, texture: 'obj_fence_h', tileX: 29 + i, tileY: 2 }),
  ),
  ...Array.from({ length: 8 }, (_, i) =>
    obj({ id: `fence_pen_bottom_${i}`, texture: 'obj_fence_h', tileX: 29 + i, tileY: 10 }),
  ),
  ...[3, 4, 5, 7, 8, 9].map((y) =>
    obj({ id: `fence_pen_left_${y}`, texture: 'obj_fence_v', tileX: 28, tileY: y }),
  ),
  ...[3, 4, 5, 6, 7, 8, 9].map((y) =>
    obj({ id: `fence_pen_right_${y}`, texture: 'obj_fence_v', tileX: 37, tileY: y }),
  ),
];

export const MAP_OBJECTS: MapObject[] = [
  // --- Pohon Induk: batang 2x2 + kanopi raksasa melayang di atas plaza.
  obj({
    id: 'mother_trunk',
    texture: 'obj_mother_trunk',
    tileX: 19,
    tileY: 1,
    tilesW: 2,
    tilesH: 2,
  }),
  obj({
    id: 'mother_canopy',
    texture: 'obj_mother_canopy',
    tileX: 16,
    tileY: -2,
    tilesW: 7,
    tilesH: 5,
    solid: [],
    layer: 'above',
  }),

  // --- Bengkel Kakek: dinding utara & samping, lantai terbuka ke selatan.
  ...[2, 3, 4, 5, 6].map((x) =>
    obj({ id: `wall_n_${x}`, texture: 'obj_wall', tileX: x, tileY: 3 }),
  ),
  obj({ id: 'lamp_workshop', texture: 'obj_lamp_off', tileX: 7, tileY: 3 }),
  obj({ id: 'wall_n_8', texture: 'obj_wall', tileX: 8, tileY: 3 }),
  ...[4, 5, 6, 7, 8].map((y) =>
    obj({ id: `wall_w_${y}`, texture: 'obj_wall_side', tileX: 1, tileY: y }),
  ),
  ...[4, 5, 6].map((y) =>
    obj({ id: `wall_e_${y}`, texture: 'obj_wall_side', tileX: 9, tileY: y }),
  ),
  obj({
    id: 'workbench',
    texture: 'obj_workbench',
    tileX: 5,
    tileY: 4,
    tilesW: 2,
    tilesH: 1,
  }),
  obj({ id: 'porch_post_l', texture: 'obj_fence_v', tileX: 2, tileY: 9 }),
  obj({ id: 'porch_post_r', texture: 'obj_fence_v', tileX: 8, tileY: 9 }),

  // --- Kandang + gerbangnya (objek gerbang diganti tekstur oleh state).
  ...FENCES,
  obj({
    id: 'pen_gate',
    texture: 'obj_gate_open',
    tileX: 28,
    tileY: 6,
    solid: [],
    solidWhenGateClosed: true,
  }),

  // --- Sungai & pintu air (bendungan kecil, anchor Q3 nanti).
  obj({
    id: 'sluice',
    texture: 'obj_sluice',
    tileX: 12,
    tileY: 22,
    tilesW: 2,
    tilesH: 2,
  }),

  // --- Plaza festival: dua kios.
  obj({ id: 'stall_l', texture: 'obj_stall', tileX: 16, tileY: 27, tilesW: 2, tilesH: 1 }),
  obj({ id: 'stall_r', texture: 'obj_stall', tileX: 22, tileY: 27, tilesW: 2, tilesH: 1 }),

  // --- Gudang konveyor roti (anchor Q5 nanti): bangunan 2x2 di selatan.
  obj({ id: 'conveyor_shed', texture: 'obj_shed', tileX: 31, tileY: 27, tilesW: 2, tilesH: 2 }),

  // --- Labirin Akar: gerbang akar raksasa di timur laut (anchor Q7 nanti).
  obj({
    id: 'root_arch',
    texture: 'obj_root_arch',
    tileX: 38,
    tileY: 0,
    tilesW: 2,
    tilesH: 2,
    solid: [
      [38, 1],
      [39, 1],
    ],
  }),

  // --- Dekorasi padat: pohon, semak, batu, orang-orangan sawah.
  ...TREES.map(([x, y], i) =>
    obj({ id: `tree_${i}`, texture: 'obj_tree', tileX: x, tileY: y, tilesW: 2, tilesH: 2, solid: [[x, y + 1]] }),
  ),
  obj({ id: 'scarecrow', texture: 'obj_scarecrow', tileX: 32, tileY: 15, solid: [[32, 15]] }),
  obj({ id: 'rock_river_1', texture: 'obj_rock', tileX: 8, tileY: 22 }),
  obj({ id: 'rock_river_2', texture: 'obj_rock', tileX: 29, tileY: 21 }),
  obj({ id: 'bush_workshop', texture: 'obj_bush', tileX: 11, tileY: 9 }),
  obj({ id: 'bush_tree_1', texture: 'obj_bush', tileX: 18, tileY: 8 }),

  // --- Papan petunjuk Pohon Induk.
  obj({ id: 'mother_sign', texture: 'obj_sign', tileX: 23, tileY: 4 }),
];

/** Ubin padat milik satu objek (memperluas 'all'). */
export function objectSolidTiles(o: MapObject): [number, number][] {
  if (o.solid !== 'all') return o.solid;
  const tiles: [number, number][] = [];
  for (let dy = 0; dy < o.tilesH; dy++) {
    for (let dx = 0; dx < o.tilesW; dx++) tiles.push([o.tileX + dx, o.tileY + dy]);
  }
  return tiles;
}

// ---------------------------------------------------------------- NPC & domba

export interface NpcPlacement {
  id: string;
  name: string;
  /** Kunci di textureSpec.CHARACTER_SPECS. */
  character: string;
  tileX: number;
  tileY: number;
  /** Radius gentayangan santai di sekitar rumah (ubin). */
  wanderRadius: number;
}

export const NPCS: NpcPlacement[] = [
  { id: 'pak_rani', name: 'Pak Rani', character: 'pak_rani', tileX: 27, tileY: 6, wanderRadius: 0 },
  { id: 'bibi_flora', name: 'Bibi Flora', character: 'bibi_flora', tileX: 6, tileY: 16, wanderRadius: 2 },
  { id: 'cici_loops', name: 'Cici Loops', character: 'cici_loops', tileX: 10, tileY: 6, wanderRadius: 1 },
  { id: 'pak_tua_query', name: 'Pak Tua Query', character: 'pak_tua_query', tileX: 16, tileY: 5, wanderRadius: 1 },
];

export interface SheepSpot {
  name: string;
  /** Posisi saat tersesat (selaras zona terakhir di data Q2). */
  lostTile: [number, number];
  /** Posisi di kandang setelah ditemukan. */
  penTile: [number, number];
  flip: boolean;
}

export const SHEEP: SheepSpot[] = [
  { name: 'Kriting', lostTile: [24, 21], penTile: [30, 5], flip: false },
  { name: 'Bolang', lostTile: [14, 21], penTile: [33, 7], flip: true },
  { name: 'Brintik', lostTile: [8, 17], penTile: [35, 4], flip: false },
];

/** Sudut tidur Piko di dalam bengkel (anchor Q1). */
export const PIKO_CORNER = { x: 3, y: 4 } as const;

// ---------------------------------------------------------------- interaksi

export type InteractableKind = 'quest' | 'npc' | 'sign' | 'flavor';

export interface Interactable {
  id: string;
  tileX: number;
  tileY: number;
  kind: InteractableKind;
  /** Teks petunjuk yang muncul saat pemain dekat. */
  prompt: string;
  /** Untuk kind 'quest': quest yang dibuka di Cyber-Deck. */
  questId?: string;
  /** Untuk kind 'quest' setelah selesai: dialog terima kasih (dialogueId). */
  doneDialogueId?: string;
  /** Untuk kind selain 'quest' (atau quest selesai): kunci dialog dunia. */
  dialogueId?: string;
  /** Quest Fase 3 yang kelak menempel di sini (kind 'flavor'). */
  futureQuestId?: string;
}

export const INTERACTABLES: Interactable[] = [
  {
    id: 'piko_corner',
    tileX: PIKO_CORNER.x,
    tileY: PIKO_CORNER.y,
    kind: 'quest',
    prompt: 'Periksa Piko',
    questId: 'quest_01_bangun_piko',
    doneDialogueId: 'piko_awake',
  },
  {
    id: 'workbench',
    tileX: 6,
    tileY: 4,
    kind: 'sign',
    prompt: 'Lihat meja kerja Kakek',
    dialogueId: 'workbench',
  },
  {
    id: 'pak_rani',
    tileX: 27,
    tileY: 6,
    kind: 'quest',
    prompt: 'Bicara dengan Pak Rani',
    questId: 'quest_02_domba_tersesat',
    doneDialogueId: 'rani_thanks',
  },
  {
    id: 'pen_gate',
    tileX: 28,
    tileY: 6,
    kind: 'sign',
    prompt: 'Lihat pintu kandang',
    dialogueId: 'pen_gate',
  },
  {
    id: 'cici_loops',
    tileX: 10,
    tileY: 6,
    kind: 'npc',
    prompt: 'Bicara dengan Cici Loops',
    dialogueId: 'cici',
  },
  {
    id: 'bibi_flora',
    tileX: 6,
    tileY: 16,
    kind: 'npc',
    prompt: 'Bicara dengan Bibi Flora',
    dialogueId: 'flora',
  },
  {
    id: 'pak_tua_query',
    tileX: 16,
    tileY: 5,
    kind: 'npc',
    prompt: 'Bicara dengan Pak Tua Query',
    dialogueId: 'query',
  },
  {
    id: 'mother_tree_sign',
    tileX: 23,
    tileY: 4,
    kind: 'sign',
    prompt: 'Baca papan Pohon Induk',
    dialogueId: 'mother_tree',
  },
  {
    id: 'mother_roots',
    tileX: 19,
    tileY: 3,
    kind: 'flavor',
    prompt: 'Sentuh akar Pohon Induk',
    dialogueId: 'great_commit',
    futureQuestId: 'quest_08_great_commit',
  },
  {
    id: 'sluice',
    tileX: 12,
    tileY: 22,
    kind: 'flavor',
    prompt: 'Lihat pintu air',
    dialogueId: 'sluice',
    futureQuestId: 'quest_03_pintu_air',
  },
  {
    id: 'farm',
    tileX: 32,
    tileY: 15,
    kind: 'flavor',
    prompt: 'Lihat ladang desa',
    dialogueId: 'farm',
    futureQuestId: 'quest_04_urutan_panen',
  },
  {
    id: 'conveyor',
    tileX: 31,
    tileY: 26,
    kind: 'flavor',
    prompt: 'Lihat gudang konveyor',
    dialogueId: 'conveyor',
    futureQuestId: 'quest_05_konveyor_roti',
  },
  {
    id: 'festival',
    tileX: 20,
    tileY: 26,
    kind: 'flavor',
    prompt: 'Lihat plaza festival',
    dialogueId: 'festival',
    futureQuestId: 'quest_06_kas_festival',
  },
  {
    id: 'root_maze',
    tileX: 38,
    tileY: 2,
    kind: 'flavor',
    prompt: 'Lihat gerbang akar',
    dialogueId: 'root_maze',
    futureQuestId: 'quest_07_jembatan_kristal',
  },
];

/** Quest Fase 3 yang belum terbit — masing-masing wajib punya jangkar rasa. */
export const FUTURE_QUEST_IDS = [
  'quest_03_pintu_air',
  'quest_04_urutan_panen',
  'quest_05_konveyor_roti',
  'quest_06_kas_festival',
  'quest_07_jembatan_kristal',
  'quest_08_great_commit',
] as const;

// ---------------------------------------------------------------- grid

export function groundAt(x: number, y: number): GroundChar | null {
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return null;
  return GROUND_ROWS[y][x] as GroundChar;
}

export function tileToWorld(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

/**
 * Grid bisa-diinjak. `gateClosed` menutup ubin gerbang kandang.
 * Objek di luar peta (kanopi Pohon Induk mulai di y=-2) tidak ikut padat
 * kecuali ubin padatnya eksplisit di dalam peta.
 */
export function buildWalkGrid(gateClosed: boolean): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < MAP_ROWS; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < MAP_COLS; x++) {
      const g = groundAt(x, y);
      row.push(g !== null && !IMPASSABLE_GROUND.has(g));
    }
    grid.push(row);
  }
  for (const o of MAP_OBJECTS) {
    const solidTiles = objectSolidTiles(o);
    for (const [x, y] of solidTiles) {
      if (x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS) grid[y][x] = false;
    }
    if (o.solidWhenGateClosed && gateClosed) {
      if (o.tileX >= 0 && o.tileY >= 0 && o.tileX < MAP_COLS && o.tileY < MAP_ROWS) {
        grid[o.tileY][o.tileX] = false;
      }
    }
  }
  return grid;
}

/** Flood fill 4-arah dari satu ubin; mengembalikan set kunci "x,y". */
export function floodReachable(
  grid: boolean[][],
  startX: number,
  startY: number,
): Set<string> {
  const seen = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  seen.add(`${startX},${startY}`);
  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (
        nx >= 0 && ny >= 0 && nx < MAP_COLS && ny < MAP_ROWS &&
        grid[ny][nx] && !seen.has(key)
      ) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

/** Ubin tetangga (termasuk diagonal) yang bisa diinjak, untuk radius interaksi. */
export function adjacentWalkable(grid: boolean[][], x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < MAP_COLS && ny < MAP_ROWS && grid[ny][nx]) {
        out.push([nx, ny]);
      }
    }
  }
  return out;
}
