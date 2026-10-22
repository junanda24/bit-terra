/**
 * Pelukis tekstur prosedural dunia (Fase 2) — SATU-SATUNYA modul dunia yang
 * menggambar. Semua tekstur lahir dari CanvasTexture saat boot: nol aset
 * eksternal (blueprint §1). Data seninya di textureSpec.ts (murni, teruji);
 * berkas ini menerjemahkannya ke piksel kanvas.
 */
import Phaser from 'phaser';
import { WORLD_PALETTE as P } from './palette';
import {
  ART_W,
  BLANK_TEXTURE,
  BODY_ROWS,
  CHARACTER_SPECS,
  CHAR_H,
  CHAR_W,
  OBJECT_TEXTURES,
  PIKO_FRAME_SIZE,
  PIKO_FRAMES,
  PIKO_TEXTURE,
  SHEEP_SIZE,
  SHEEP_TEXTURE,
  TILE_TEXTURES,
  type CharacterSpec,
} from './textureSpec';

type Ctx = CanvasRenderingContext2D;

/** Variasi deterministik per koordinat (tanpa Math.random — peta stabil). */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function make(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx, w: number, h: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

function r(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function circle(ctx: Ctx, cx: number, cy: number, rad: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
}

/** Taburan bintik deterministik di satu ubin. */
function speckle(
  ctx: Ctx,
  seedX: number,
  seedY: number,
  color: string,
  count: number,
  size = 2,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const px = Math.floor(hash2(seedX * 31 + i, seedY * 17 + i * 7) * 30);
    const py = Math.floor(hash2(seedX * 13 + i * 3, seedY * 41 + i) * 30);
    ctx.fillRect(px, py, size, size);
  }
}

// ---------------------------------------------------------------- ubin

const TILE_PAINTERS: Record<string, (ctx: Ctx, s: number) => void> = {
  tex_grass(ctx, s) {
    r(ctx, 0, 0, s, s, P.moss);
    speckle(ctx, s, 1, P.mossLight, 7);
    speckle(ctx, s, 2, P.mossDark, 6);
    // Tiga bilah rumput tegak.
    r(ctx, 6, 20, 2, 6, P.mossLight);
    r(ctx, 22, 8, 2, 6, P.mossDark);
    r(ctx, 15, 24, 2, 5, P.mossLight);
  },
  tex_path(ctx, s) {
    r(ctx, 0, 0, s, s, '#b39c6d');
    speckle(ctx, 3, 3, '#a08b5e', 8);
    speckle(ctx, 4, 4, '#c4ac7d', 7);
    speckle(ctx, 5, 5, '#8a744c', 4, 3);
  },
  tex_water(ctx, s) {
    r(ctx, 0, 0, s, s, P.river);
    r(ctx, 0, 24, s, 8, P.riverDark);
    r(ctx, 4, 8, 10, 2, P.riverLight);
    r(ctx, 18, 16, 10, 2, P.riverLight);
    r(ctx, 10, 26, 8, 2, P.riverLight);
  },
  tex_bridge(ctx, s) {
    r(ctx, 0, 0, s, s, P.riverDark);
    for (let i = 0; i < 4; i++) {
      r(ctx, i * 8, 2, 7, 28, i % 2 ? P.wood : P.woodLight);
      r(ctx, i * 8 + 3, 6, 2, 2, P.woodDark);
      r(ctx, i * 8 + 3, 24, 2, 2, P.woodDark);
    }
    r(ctx, 0, 0, s, 3, P.woodDark);
    r(ctx, 0, 29, s, 3, P.woodDark);
  },
  tex_soil(ctx, s) {
    r(ctx, 0, 0, s, s, P.soil);
    for (const y of [5, 14, 23]) {
      r(ctx, 0, y, s, 4, P.soilDark);
      r(ctx, 0, y + 4, s, 1, '#7d5a38');
    }
    speckle(ctx, 6, 6, '#7d5a38', 5);
  },
  tex_crops(ctx, s) {
    TILE_PAINTERS.tex_soil(ctx, s);
    for (const y of [3, 12, 21]) {
      for (let x = 3; x < 30; x += 8) {
        r(ctx, x, y, 2, 6, P.mossLight);
        r(ctx, x - 2, y + 2, 6, 2, P.moss);
        r(ctx, x, y - 1, 2, 2, '#7fae6d');
      }
    }
  },
  tex_flowerbed(ctx, s) {
    TILE_PAINTERS.tex_grass(ctx, s);
    const cols = [P.sun, '#e86a92', P.cream, P.coral];
    for (let i = 0; i < 6; i++) {
      const px = 3 + Math.floor(hash2(i * 7, s) * 26);
      const py = 3 + Math.floor(hash2(s, i * 11) * 26);
      circle(ctx, px, py, 2, cols[i % cols.length]);
      circle(ctx, px, py, 1, P.cream);
    }
  },
  tex_plaza(ctx, s) {
    r(ctx, 0, 0, s, s, P.stoneDark);
    r(ctx, 1, 1, 14, 14, P.stone);
    r(ctx, 17, 1, 14, 14, '#a29a86');
    r(ctx, 1, 17, 14, 14, '#a29a86');
    r(ctx, 17, 17, 14, 14, P.stone);
    speckle(ctx, 7, 7, P.stoneDark, 4, 1);
  },
  tex_pen(ctx, s) {
    r(ctx, 0, 0, s, s, '#8a6a44');
    speckle(ctx, 8, 8, '#75572f', 8);
    speckle(ctx, 9, 9, '#9c7c50', 7);
    r(ctx, 5, 10, 7, 1, P.sun);
    r(ctx, 20, 22, 8, 1, P.sun);
    r(ctx, 12, 27, 6, 1, '#d9b36a');
  },
  tex_planks(ctx, s) {
    r(ctx, 0, 0, s, s, P.woodDark);
    for (let i = 0; i < 4; i++) {
      r(ctx, i * 8 + 1, 0, 6, s, i % 2 ? P.wood : '#9c4e2d');
      r(ctx, i * 8 + 3, 5, 1, 8, P.woodDark);
      r(ctx, i * 8 + 3, 20, 1, 7, P.woodDark);
    }
  },
};

// ---------------------------------------------------------------- objek

function paintTree(ctx: Ctx): void {
  r(ctx, 28, 52, 8, 28, P.woodDark);
  r(ctx, 30, 52, 3, 28, P.wood);
  circle(ctx, 32, 28, 24, P.mossDark);
  circle(ctx, 16, 36, 15, P.mossDark);
  circle(ctx, 48, 36, 15, P.mossDark);
  circle(ctx, 32, 22, 19, P.moss);
  circle(ctx, 20, 30, 12, P.moss);
  circle(ctx, 44, 28, 12, P.mossLight);
  circle(ctx, 26, 16, 9, P.mossLight);
  circle(ctx, 40, 40, 2, P.coral);
  circle(ctx, 18, 24, 2, P.coral);
  circle(ctx, 34, 34, 2, P.sun);
}

function paintWallBase(ctx: Ctx, vertical: boolean): void {
  r(ctx, 0, 0, 32, 40, P.woodDark);
  if (vertical) {
    for (let i = 0; i < 4; i++) r(ctx, i * 8 + 1, 2, 6, 36, i % 2 ? P.wood : '#9c4e2d');
  } else {
    for (let i = 0; i < 4; i++) r(ctx, 1, i * 9 + 2, 30, 7, i % 2 ? P.wood : '#9c4e2d');
    r(ctx, 0, 0, 32, 5, P.woodDark);
    // Jendela kecil dengan bingkai tembaga.
    r(ctx, 19, 12, 10, 12, P.copper);
    r(ctx, 21, 14, 6, 8, '#ffe9a8');
    r(ctx, 23, 14, 1, 8, P.copper);
    r(ctx, 21, 17, 6, 1, P.copper);
  }
  r(ctx, 0, 36, 32, 4, 'rgba(0,0,0,0.25)');
}

function paintLamp(ctx: Ctx, on: boolean): void {
  r(ctx, 14, 10, 4, 20, P.woodDark);
  if (on) {
    circle(ctx, 16, 10, 13, 'rgba(244,180,27,0.20)');
    circle(ctx, 16, 10, 9, 'rgba(244,180,27,0.30)');
  }
  r(ctx, 10, 2, 12, 13, '#3a332a');
  r(ctx, 12, 4, 8, 9, on ? '#ffd75e' : '#5a6068');
  r(ctx, 9, 0, 14, 3, P.copper);
}

const OBJECT_PAINTERS: Record<string, (ctx: Ctx, w: number, h: number) => void> = {
  obj_tree: (ctx) => paintTree(ctx),
  obj_bush(ctx) {
    circle(ctx, 12, 20, 10, P.mossDark);
    circle(ctx, 22, 18, 11, P.moss);
    circle(ctx, 16, 12, 8, P.mossLight);
    circle(ctx, 10, 16, 1.6, P.coral);
    circle(ctx, 22, 22, 1.6, P.coral);
    circle(ctx, 18, 10, 1.6, P.sun);
  },
  obj_rock(ctx) {
    r(ctx, 4, 16, 24, 12, P.stoneDark);
    r(ctx, 7, 9, 18, 10, P.stone);
    r(ctx, 10, 6, 10, 6, '#aaa28d');
    r(ctx, 6, 24, 20, 3, 'rgba(0,0,0,0.2)');
  },
  obj_fence_h(ctx) {
    r(ctx, 2, 6, 4, 24, P.woodDark);
    r(ctx, 26, 6, 4, 24, P.woodDark);
    r(ctx, 0, 10, 32, 5, P.wood);
    r(ctx, 0, 20, 32, 5, P.woodLight);
    r(ctx, 0, 14, 32, 1, P.woodDark);
  },
  obj_fence_v(ctx) {
    r(ctx, 13, 0, 6, 32, P.woodDark);
    r(ctx, 14, 0, 3, 32, P.wood);
    r(ctx, 8, 10, 16, 5, P.wood);
    r(ctx, 8, 20, 16, 5, P.woodLight);
  },
  obj_gate_open(ctx) {
    r(ctx, 28, 4, 4, 26, P.woodDark);
    // Panel gerbang terbuka ke dalam (menempel sisi kiri).
    r(ctx, 2, 6, 5, 22, P.wood);
    r(ctx, 2, 6, 5, 4, P.woodLight);
    r(ctx, 2, 24, 5, 4, P.woodLight);
    r(ctx, 3, 15, 3, 3, P.copper);
  },
  obj_gate_closed(ctx) {
    r(ctx, 1, 4, 4, 26, P.woodDark);
    r(ctx, 27, 4, 4, 26, P.woodDark);
    r(ctx, 4, 7, 24, 20, P.wood);
    r(ctx, 4, 7, 24, 4, P.woodLight);
    r(ctx, 4, 23, 24, 4, P.woodLight);
    ctx.strokeStyle = P.woodDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(5, 26);
    ctx.lineTo(27, 8);
    ctx.stroke();
    r(ctx, 24, 15, 5, 5, P.copper);
  },
  obj_wall: (ctx) => paintWallBase(ctx, false),
  obj_wall_side: (ctx) => paintWallBase(ctx, true),
  obj_workbench(ctx) {
    r(ctx, 2, 10, 60, 6, P.woodLight);
    r(ctx, 2, 16, 60, 3, P.woodDark);
    r(ctx, 6, 19, 5, 13, P.woodDark);
    r(ctx, 53, 19, 5, 13, P.woodDark);
    // Palu, roda gigi tembaga, dan cangkir di atas meja.
    r(ctx, 10, 4, 10, 3, '#8a8f98');
    r(ctx, 17, 2, 3, 8, P.woodDark);
    circle(ctx, 34, 7, 5, P.copper);
    circle(ctx, 34, 7, 2, P.woodDark);
    r(ctx, 48, 3, 7, 7, P.coral);
    r(ctx, 55, 5, 3, 3, P.coral);
  },
  obj_lamp_on: (ctx) => paintLamp(ctx, true),
  obj_lamp_off: (ctx) => paintLamp(ctx, false),
  obj_sign(ctx) {
    r(ctx, 14, 12, 4, 20, P.woodDark);
    r(ctx, 3, 2, 26, 15, P.wood);
    r(ctx, 5, 4, 22, 11, P.woodLight);
    r(ctx, 8, 7, 16, 2, P.woodDark);
    r(ctx, 8, 11, 11, 2, P.woodDark);
  },
  obj_stall(ctx) {
    r(ctx, 4, 18, 4, 30, P.woodDark);
    r(ctx, 56, 18, 4, 30, P.woodDark);
    for (let i = 0; i < 6; i++) r(ctx, i * 11, 2, 6, 12, i % 2 ? P.cream : P.coral);
    r(ctx, 0, 12, 64, 4, P.woodDark);
    r(ctx, 2, 32, 60, 8, P.wood);
    r(ctx, 8, 24, 12, 8, P.copper);
    r(ctx, 26, 23, 10, 9, P.sun);
    r(ctx, 44, 24, 12, 8, P.moss);
  },
  obj_shed(ctx, w, h) {
    r(ctx, 4, 16, w - 8, h - 16, P.wood);
    r(ctx, 4, 22, w - 8, 3, P.woodDark);
    r(ctx, 4, 36, w - 8, 3, P.woodDark);
    r(ctx, 4, 50, w - 8, 3, P.woodDark);
    // Atap terakota.
    r(ctx, 0, 0, w, 10, P.woodDark);
    r(ctx, 2, 2, w - 4, 10, '#b85c24');
    for (let x = 6; x < w - 4; x += 8) r(ctx, x, 3, 2, 8, P.woodDark);
    // Pintu + jendela kecil.
    r(ctx, 10, 30, 16, 34, P.woodDark);
    r(ctx, 13, 33, 10, 12, '#2c3846');
    r(ctx, 42, 28, 12, 12, P.copper);
    r(ctx, 44, 30, 8, 8, '#ffe9a8');
  },
  obj_sluice(ctx, w) {
    r(ctx, 0, 34, w, 30, P.riverDark);
    r(ctx, 0, 40, w, 4, P.riverLight);
    r(ctx, 2, 8, 12, 56, P.stone);
    r(ctx, 50, 8, 12, 56, P.stone);
    r(ctx, 2, 8, 12, 6, P.stoneDark);
    r(ctx, 50, 8, 12, 6, P.stoneDark);
    for (let i = 0; i < 4; i++) r(ctx, 17 + i * 8, 14, 6, 42, i % 2 ? P.wood : P.woodLight);
    r(ctx, 14, 10, 36, 5, P.woodDark);
    // Roda tuas tembaga.
    circle(ctx, 32, 8, 8, P.copper);
    circle(ctx, 32, 8, 3, P.woodDark);
    r(ctx, 31, 0, 2, 16, P.copper);
    r(ctx, 24, 7, 16, 2, P.copper);
  },
  obj_root_arch(ctx) {
    r(ctx, 2, 26, 14, 38, '#6b4630');
    r(ctx, 48, 26, 14, 38, '#6b4630');
    ctx.strokeStyle = '#6b4630';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(8, 30);
    ctx.quadraticCurveTo(10, 2, 32, 4);
    ctx.quadraticCurveTo(54, 2, 56, 30);
    ctx.stroke();
    ctx.strokeStyle = '#7c5138';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(9, 32);
    ctx.quadraticCurveTo(12, 8, 32, 9);
    ctx.stroke();
    circle(ctx, 10, 8, 8, P.mossDark);
    circle(ctx, 54, 8, 8, P.mossDark);
    circle(ctx, 30, 2, 7, P.moss);
    r(ctx, 20, 8, 2, 12, P.mossDark);
    r(ctx, 44, 10, 2, 9, P.mossDark);
  },
  obj_scarecrow(ctx) {
    r(ctx, 14, 14, 4, 34, P.woodDark);
    r(ctx, 3, 20, 26, 4, P.woodDark);
    r(ctx, 9, 2, 14, 5, '#d9b36a');
    r(ctx, 11, 0, 10, 4, '#b8934a');
    r(ctx, 11, 7, 10, 7, '#e8cf9f');
    r(ctx, 9, 16, 14, 18, P.copper);
    r(ctx, 9, 22, 14, 3, P.woodDark);
    r(ctx, 2, 18, 4, 8, P.sun);
    r(ctx, 26, 18, 4, 8, P.sun);
  },
  obj_mother_trunk(ctx) {
    r(ctx, 14, 6, 36, 58, '#6b4630');
    r(ctx, 20, 6, 10, 58, '#7c5138');
    r(ctx, 4, 50, 20, 14, '#6b4630');
    r(ctx, 40, 50, 20, 14, '#6b4630');
    r(ctx, 10, 20, 3, 30, '#54371f');
    r(ctx, 48, 14, 3, 26, '#54371f');
    // Lubang simpul bercahaya amber — denyut memori pohon.
    circle(ctx, 32, 30, 6, '#8a5a20');
    circle(ctx, 32, 30, 4, P.amber);
    circle(ctx, 32, 30, 2, '#ffe9a8');
    circle(ctx, 16, 46, 3, P.moss);
    circle(ctx, 48, 44, 3, P.mossDark);
  },
  obj_mother_canopy(ctx, w, h) {
    const blobs: [number, number, number, string][] = [
      [112, 74, 62, P.mossDark],
      [52, 88, 44, P.mossDark],
      [172, 88, 44, P.mossDark],
      [84, 56, 46, P.moss],
      [140, 56, 46, P.moss],
      [112, 88, 48, P.moss],
      [66, 70, 30, P.mossLight],
      [158, 70, 30, P.mossLight],
      [112, 44, 34, P.mossLight],
      [94, 96, 26, '#6f9e63'],
      [132, 96, 26, '#6f9e63'],
    ];
    for (const [x, y, rad, col] of blobs) circle(ctx, x, y, rad, col);
    // Kunang-kunang / serbuk cahaya di antara daun.
    for (let i = 0; i < 14; i++) {
      const px = 24 + hash2(i * 3, 7) * (w - 48);
      const py = 30 + hash2(11, i * 5) * (h - 60);
      circle(ctx, px, py, 1.6, 'rgba(255,215,94,0.85)');
    }
    circle(ctx, 52, 60, 3, P.coral);
    circle(ctx, 176, 96, 3, P.coral);
    circle(ctx, 128, 30, 3, P.sun);
  },
};

// ---------------------------------------------------------------- karakter

function paintArtRows(
  ctx: Ctx,
  spec: CharacterSpec,
  rows: string[],
  originX: number,
  originY: number,
): void {
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < ART_W; col++) {
      const ch = line[col];
      if (ch === '.' || ch === undefined) continue;
      const color = spec.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(originX + col * 2, originY + row * 2, 2, 2);
    }
  }
}

function paintCharacterSheet(scene: Phaser.Scene, spec: CharacterSpec): void {
  make(scene, spec.key, CHAR_W * 3, CHAR_H * 3, (ctx) => {
    const views = ['down', 'up', 'side'] as const;
    const legVariants = [spec.legs.stand, spec.legs.stepA, spec.legs.stepB];
    views.forEach((view, viewIdx) => {
      legVariants.forEach((legs, frameIdx) => {
        const ox = frameIdx * CHAR_W;
        const oy = viewIdx * CHAR_H;
        paintArtRows(ctx, spec, spec.views[view], ox, oy);
        paintArtRows(ctx, spec, legs, ox, oy + BODY_ROWS * 2);
      });
    });
  });
  const tex = scene.textures.get(spec.key);
  const views = ['down', 'up', 'side'] as const;
  views.forEach((view, viewIdx) => {
    for (let frameIdx = 0; frameIdx < 3; frameIdx++) {
      const name = `${view}_${frameIdx}`;
      if (!tex.has(name)) {
        tex.add(name, 0, frameIdx * CHAR_W, viewIdx * CHAR_H, CHAR_W, CHAR_H);
      }
    }
  });
}

// ---------------------------------------------------------------- piko & domba

function paintPiko(ctx: Ctx, frame: number): void {
  // Antena + daun.
  r(ctx, 15, 2, 2, 6, '#8a8f98');
  circle(ctx, 20, 4, 3.4, P.moss);
  circle(ctx, 12, 5, 2.4, P.mossLight);
  // Badan bulat krem-metalik.
  circle(ctx, 16, 19, 12, '#b8ab90');
  circle(ctx, 16, 18, 11, '#e6dcc4');
  circle(ctx, 12, 13, 4, 'rgba(255,255,255,0.5)');
  // Layar wajah CRT.
  r(ctx, 8, 11, 16, 12, '#101820');
  r(ctx, 9, 12, 14, 10, frame === 2 ? '#1a2a24' : '#14342a');
  const eye = frame === 2 ? '#3d5a4c' : P.mint;
  if (frame === 1) {
    // Mata senang: lengkung ^ ^
    r(ctx, 11, 15, 4, 2, eye);
    r(ctx, 11, 14, 2, 2, eye);
    r(ctx, 17, 15, 4, 2, eye);
    r(ctx, 19, 14, 2, 2, eye);
    r(ctx, 14, 19, 4, 2, eye);
  } else if (frame === 2) {
    // Tertidur: garis mata tertutup.
    r(ctx, 11, 16, 4, 1, eye);
    r(ctx, 17, 16, 4, 1, eye);
  } else {
    circle(ctx, 13, 16, 1.8, eye);
    circle(ctx, 19, 16, 1.8, eye);
    r(ctx, 14, 19, 4, 1, eye);
  }
  // Kaki kecil.
  r(ctx, 10, 29, 5, 3, '#57503f');
  r(ctx, 17, 29, 5, 3, '#57503f');
}

function paintSheep(ctx: Ctx): void {
  // Kaki + ekor.
  r(ctx, 8, 22, 3, 6, '#4a3b2c');
  r(ctx, 24, 22, 3, 6, '#4a3b2c');
  circle(ctx, 4, 12, 4, '#efe9dc');
  // Badan wol: gumpalan lingkaran krem.
  const puffs: [number, number, number][] = [
    [12, 14, 8], [20, 12, 9], [26, 15, 7], [16, 17, 8], [24, 18, 7], [10, 18, 6],
  ];
  for (const [x, y, rad] of puffs) circle(ctx, x, y, rad, '#f4efe2');
  for (const [x, y, rad] of puffs) circle(ctx, x - 2, y - 2, rad - 3, '#fdfaf1');
  // Kepala gelap di kanan + telinga + mata.
  circle(ctx, 31, 13, 5, '#4a3b2c');
  circle(ctx, 27, 9, 2.6, '#4a3b2c');
  circle(ctx, 32, 12, 1.2, '#fdfaf1');
}

/** Hasilkan semua tekstur dunia. Aman dipanggil ulang (skip yang sudah ada). */
export function generateWorldTextures(scene: Phaser.Scene): void {
  make(scene, BLANK_TEXTURE, 2, 2, (ctx) => {
    r(ctx, 0, 0, 2, 2, '#ffffff');
  });

  for (const [key, size] of Object.entries(TILE_TEXTURES)) {
    const painter = TILE_PAINTERS[key];
    if (painter) make(scene, key, size.w, size.h, (ctx) => painter(ctx, size.w));
  }
  for (const [key, size] of Object.entries(OBJECT_TEXTURES)) {
    const painter = OBJECT_PAINTERS[key];
    if (painter) make(scene, key, size.w, size.h, (ctx) => painter(ctx, size.w, size.h));
  }
  for (const spec of Object.values(CHARACTER_SPECS)) {
    paintCharacterSheet(scene, spec);
  }

  make(scene, PIKO_TEXTURE, PIKO_FRAME_SIZE * PIKO_FRAMES.length, PIKO_FRAME_SIZE, (ctx) => {
    PIKO_FRAMES.forEach((_, i) => {
      ctx.save();
      ctx.translate(i * PIKO_FRAME_SIZE, 0);
      paintPiko(ctx, i);
      ctx.restore();
    });
  });
  const pikoTex = scene.textures.get(PIKO_TEXTURE);
  PIKO_FRAMES.forEach((name, i) => {
    if (!pikoTex.has(name)) {
      pikoTex.add(name, 0, i * PIKO_FRAME_SIZE, 0, PIKO_FRAME_SIZE, PIKO_FRAME_SIZE);
    }
  });

  make(scene, SHEEP_TEXTURE, SHEEP_SIZE.w, SHEEP_SIZE.h, (ctx) => paintSheep(ctx));
}
