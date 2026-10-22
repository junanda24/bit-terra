/**
 * Spesifikasi tekstur prosedural dunia Bit-Terra (Fase 2) — TANPA Phaser.
 *
 * Semua seni dunia digambar dari data di berkas ini + kode gambar di
 * textures.ts ke CanvasTexture saat boot: nol aset biner/eksternal.
 * Berkas ini murni data sehingga bisa diuji di node (konsistensi registri,
 * geometri seni piksel) tanpa canvas.
 *
 * Konvensi seni karakter: kisi 16x20 "unit piksel" (1 unit = 2 px layar)
 * menghasilkan bingkai 32x40 px. Setiap karakter punya 3 tampak badan
 * (down/up/side — side menghadap kiri; kanan = flipX di engine) dan
 * potongan kaki 3 varian (stand/stepA/stepB) untuk siklus jalan 2 frame.
 */

export const TILE_SIZE = 32;
export const CHAR_W = 32;
export const CHAR_H = 40;
export const ART_W = 16;
export const ART_H = 20;
/** Baris badan 0..15, baris kaki 16..19. */
export const BODY_ROWS = 16;

export type Direction = 'down' | 'up' | 'side';

/** Kaki: pola 4 baris x 3 varian jalan. */
export interface LegSpec {
  stand: string[];
  stepA: string[];
  stepB: string[];
}

export interface CharacterSpec {
  /** Kunci tekstur Phaser, mis. 'char_player'. */
  key: string;
  /** Palet: karakter seni -> warna hex. '.' selalu transparan. */
  palette: Record<string, string>;
  views: Record<Direction, string[]>;
  legs: LegSpec;
}

/** Pola kaki celana standar (celana + sepatu dari palet pemakai). */
function pantsLegs(): LegSpec {
  return {
    stand: [
      '.....XX..XX.....',
      '.....XX..XX.....',
      '.....XX..XX.....',
      '....BBB..BBB....',
    ],
    stepA: [
      '.....XX..XX.....',
      '.....XX..XX.....',
      '....XXX...XX....',
      '...BBB....BBB...',
    ],
    stepB: [
      '.....XX..XX.....',
      '.....XX..XX.....',
      '....XX...XXX....',
      '...BBB....BBB...',
    ],
  };
}

/** Pola kaki gaun/jubah: ujung kain bergoyang, sepatu mengintip. */
function hemLegs(): LegSpec {
  return {
    stand: [
      '....XXXXXXXX....',
      '....XXXXXXXX....',
      '....XXXXXXXX....',
      '.....BB..BB.....',
    ],
    stepA: [
      '....XXXXXXXX....',
      '....XXXXXXXX....',
      '.....XXXXXX.....',
      '....BB....BB....',
    ],
    stepB: [
      '....XXXXXXXX....',
      '....XXXXXXXX....',
      '....XXXXXX......',
      '.....BB...BB....',
    ],
  };
}

const RAYAN: CharacterSpec = {
  key: 'char_player',
  palette: {
    H: '#5a3a22',
    S: '#e8b08a',
    E: '#26303f',
    Y: '#f4b41b',
    y: '#cf9413',
    D: '#3f6296',
    B: '#5b3a29',
    C: '#c87d55',
    X: '#3f6296',
  },
  views: {
    down: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HSSSSSSH....',
      '....CCCCCCCC....',
      '....SESSSSES....',
      '.....SSSSSS.....',
      '....YYYYYYYY....',
      '...YYYYYYYYYY...',
      '...YYDYYYYDYY...',
      '...SYDYYYYDYS...',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
    ],
    up: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '.....HHHHHH.....',
      '....YyyyyyyY....',
      '...YYYYYYYYYY...',
      '...YYYYYYYYYY...',
      '...YYYYYYYYYY...',
      '...SYYYYYYYYS...',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
      '....DDDDDDDD....',
    ],
    side: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....SSSSSHHH....',
      '...CSSSSHHHH....',
      '....SESSSSHH....',
      '.....SSSSS......',
      '....YYYYYYY.....',
      '....YYYYYYYY....',
      '....YDYYYYY.....',
      '....SYYYYY......',
      '....DDDDDD......',
      '....DDDDDD......',
      '....DDDDDD......',
      '....DDDDDD......',
      '....DDDDDD......',
    ],
  },
  legs: pantsLegs(),
};

const PAK_RANI: CharacterSpec = {
  key: 'char_rani',
  palette: {
    T: '#d9b36a',
    t: '#b8934a',
    S: '#c98a5e',
    E: '#26303f',
    M: '#d8d2c4',
    N: '#4b724f',
    n: '#3c5c40',
    P: '#6b4a2f',
    B: '#42301f',
    X: '#6b4a2f',
  },
  views: {
    down: [
      '................',
      '.....TTTTTT.....',
      '..TTTTTTTTTTTT..',
      '....SSSSSSSS....',
      '....SESSSSES....',
      '.....SSSSSS.....',
      '....SSMMMMSS....',
      '....NNNNNNNN....',
      '...NNNNNNNNNN...',
      '...NNNNNNNNNN...',
      '...SNNNNNNNNS...',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
    ],
    up: [
      '................',
      '.....TTTTTT.....',
      '..TTTTTTTTTTTT..',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '.....SSSSSS.....',
      '....NNNNNNNN....',
      '...NNNNNNNNNN...',
      '...NNNNNNNNNN...',
      '...NNNNNNNNNN...',
      '...SNNNNNNNNS...',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
    ],
    side: [
      '................',
      '.....TTTTTT.....',
      '.TTTTTTTTTTTT...',
      '....SSSSSTTT....',
      '....SESSSSTT....',
      '.....SSSSS......',
      '....SSMMMS......',
      '....NNNNNNN.....',
      '....NNNNNNNN....',
      '....NNNNNN......',
      '....SNNNN.......',
      '....PPPPPP......',
      '....PPPPPP......',
      '....PPPPPP......',
      '....PPPPPP......',
      '....PPPPPP......',
    ],
  },
  legs: pantsLegs(),
};

const BIBI_FLORA: CharacterSpec = {
  key: 'char_flora',
  palette: {
    W: '#f2ead6',
    R: '#e86a92',
    H: '#3d2b1f',
    S: '#e8b08a',
    E: '#26303f',
    V: '#3f8f7a',
    v: '#2f6e5d',
    B: '#5b3a29',
    X: '#3f8f7a',
  },
  views: {
    down: [
      '................',
      '.....WWWWWW.....',
      '..WWWWWWWWWWWW..',
      '....HSSSSSSH....',
      '....HSESSESH....',
      '....HSSSSSSH....',
      '.....SSSSSS.....',
      '....VVVVVVVV....',
      '...VVWWWWWWVV...',
      '...VVWWWWWWVV...',
      '...SVVVVVVVVS...',
      '....VVVVVVVV....',
      '...VVVVVVVVVV...',
      '...VVVVVVVVVV...',
      '..VVVVVVVVVVVV..',
      '..VVVVVVVVVVVV..',
    ],
    up: [
      '................',
      '.....WWWWWW.....',
      '..WWWWWWWWWWWW..',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '.....HHHHHH.....',
      '....VVVVVVVV....',
      '...VVVVVVVVVV...',
      '...VVVVVVVVVV...',
      '...SVVVVVVVVS...',
      '....VVVVVVVV....',
      '...VVVVVVVVVV...',
      '...VVVVVVVVVV...',
      '..VVVVVVVVVVVV..',
      '..VVVVVVVVVVVV..',
    ],
    side: [
      '................',
      '.....WWWWWW.....',
      '.WWWWWWWWWWWW...',
      '....SSSSSWWW....',
      '....SESSSSHH....',
      '....SSSSSSHH....',
      '.....SSSSS......',
      '....VVVVVV......',
      '....VVWWWV......',
      '....VVWWWV......',
      '....SVVVV.......',
      '....VVVVVV......',
      '...VVVVVVV......',
      '...VVVVVVV......',
      '..VVVVVVVV......',
      '..VVVVVVVV......',
    ],
  },
  legs: hemLegs(),
};

const CICI_LOOPS: CharacterSpec = {
  key: 'char_cici',
  palette: {
    C: '#e07b39',
    c: '#b85c24',
    H: '#2b2b33',
    S: '#d99a68',
    E: '#1d222b',
    W: '#e8e4da',
    O: '#e07b39',
    K: '#374151',
    B: '#2b2b33',
    X: '#374151',
  },
  views: {
    down: [
      '................',
      '.....CCCCCC.....',
      '....CCCCCCCC....',
      '...CCCCCCCCCC...',
      '....HSSSSSSH....',
      '....HSESSESH....',
      '....HSSSSSSH....',
      '....OOOOOOOO....',
      '...WOOOOOOOOW...',
      '...WOOOOOOOOW...',
      '...SOOOOOOOOS...',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
    ],
    up: [
      '................',
      '.....CCCCCC.....',
      '....CCCCCCCC....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '.....HHHHHH.....',
      '....OOOOOOOO....',
      '...WOOOOOOOOW...',
      '...WOOOOOOOOW...',
      '...SOOOOOOOOS...',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
    ],
    side: [
      '................',
      '.....CCCCCC.....',
      '..CCCCCCCCCC....',
      '....SSSSSHHH....',
      '....SESSSSHH....',
      '....SSSSSSHH....',
      '.....SSSSS......',
      '....OOOOOO......',
      '...WOOOOOOO.....',
      '....OOOOOO......',
      '....SOOOO.......',
      '....KKKKKK......',
      '....KKKKKK......',
      '....KKKKKK......',
      '....KKKKKK......',
      '....KKKKKK......',
    ],
  },
  legs: pantsLegs(),
};

const PAK_TUA_QUERY: CharacterSpec = {
  key: 'char_query',
  palette: {
    M: '#cfc9bb',
    m: '#a89f8a',
    S: '#d99a68',
    E: '#26303f',
    U: '#5b7fa6',
    u: '#476786',
    B: '#4a3b2c',
    X: '#5b7fa6',
  },
  views: {
    down: [
      '................',
      '.....MMMMMM.....',
      '....MMMMMMMM....',
      '....MSSSSSSM....',
      '....MSESSESM....',
      '.....SSSSSS.....',
      '.....MMMMMM.....',
      '....MMMMMMMM....',
      '....MUUUUUUM....',
      '....MUUUUUUM....',
      '....SUUUUUUS....',
      '....UUUUUUUU....',
      '....UUUUUUUU....',
      '...UUUUUUUUUU...',
      '...UUUUUUUUUU...',
      '...UUUUUUUUUU...',
    ],
    up: [
      '................',
      '.....MMMMMM.....',
      '....MMMMMMMM....',
      '....MMMMMMMM....',
      '....MMMMMMMM....',
      '.....MMMMMM.....',
      '....UUUUUUUU....',
      '...UUUUUUUUUU...',
      '...UUUUUUUUUU...',
      '...UUUUUUUUUU...',
      '...SUUUUUUUUS...',
      '....UUUUUUUU....',
      '....UUUUUUUU....',
      '...UUUUUUUUUU...',
      '...UUUUUUUUUU...',
      '...UUUUUUUUUU...',
    ],
    side: [
      '................',
      '.....MMMMMM.....',
      '....MMMMMMMM....',
      '....SSSSSMMM....',
      '....SESSSSMM....',
      '....SSSSSSMM....',
      '.....MMMMM......',
      '....MMMMMM......',
      '....UUUUUU......',
      '....UUUUUU......',
      '....SUUUU.......',
      '....UUUUUU......',
      '....UUUUUU......',
      '...UUUUUUU......',
      '...UUUUUUU......',
      '...UUUUUUU......',
    ],
  },
  legs: hemLegs(),
};

export const CHARACTER_SPECS: Record<string, CharacterSpec> = {
  player: RAYAN,
  pak_rani: PAK_RANI,
  bibi_flora: BIBI_FLORA,
  cici_loops: CICI_LOOPS,
  pak_tua_query: PAK_TUA_QUERY,
};

/** Nama frame di dalam sheet karakter: '<arah>_<0 diam|1 langkah A|2 langkah B>'. */
export const FRAME_DIRECTIONS = ['down', 'up', 'side'] as const;
export const FRAME_SUFFIXES = [0, 1, 2] as const;

/** Tekstur ubin & objek statis yang digambar textures.ts (kunci -> ukuran px). */
export const TILE_TEXTURES: Record<string, { w: number; h: number }> = {
  tex_grass: { w: 32, h: 32 },
  tex_path: { w: 32, h: 32 },
  tex_water: { w: 32, h: 32 },
  tex_bridge: { w: 32, h: 32 },
  tex_soil: { w: 32, h: 32 },
  tex_crops: { w: 32, h: 32 },
  tex_flowerbed: { w: 32, h: 32 },
  tex_plaza: { w: 32, h: 32 },
  tex_pen: { w: 32, h: 32 },
  tex_planks: { w: 32, h: 32 },
};

/** Tekstur objek (di atas ubin tanah) yang digambar textures.ts. */
export const OBJECT_TEXTURES: Record<string, { w: number; h: number }> = {
  obj_tree: { w: 64, h: 80 },
  obj_bush: { w: 32, h: 32 },
  obj_rock: { w: 32, h: 32 },
  obj_fence_h: { w: 32, h: 32 },
  obj_fence_v: { w: 32, h: 32 },
  obj_gate_open: { w: 32, h: 32 },
  obj_gate_closed: { w: 32, h: 32 },
  obj_wall: { w: 32, h: 40 },
  obj_wall_side: { w: 32, h: 40 },
  obj_workbench: { w: 64, h: 32 },
  obj_lamp_on: { w: 32, h: 32 },
  obj_lamp_off: { w: 32, h: 32 },
  obj_sign: { w: 32, h: 32 },
  obj_stall: { w: 64, h: 48 },
  obj_shed: { w: 64, h: 64 },
  obj_sluice: { w: 64, h: 64 },
  obj_root_arch: { w: 64, h: 64 },
  obj_scarecrow: { w: 32, h: 48 },
  obj_mother_trunk: { w: 64, h: 64 },
  obj_mother_canopy: { w: 224, h: 160 },
};

/** Piko: 3 frame 32x32 sebaris (bangun, senang, tertidur). */
export const PIKO_TEXTURE = 'piko';
export const PIKO_FRAMES = ['awake', 'happy', 'asleep'] as const;
export const PIKO_FRAME_SIZE = 32;

/** Domba: satu frame 36x28. */
export const SHEEP_TEXTURE = 'sheep';
export const SHEEP_SIZE = { w: 36, h: 28 } as const;

/** Tekstur kosong 1x1 untuk badan statis tak terlihat. */
export const BLANK_TEXTURE = 'tex_blank';
