/**
 * Keadaan dunia sebagai fungsi murni dari progres pemain (Fase 2).
 *
 * Dunia TIDAK punya skema save sendiri: semua keadaan visual desa
 * (lampu bengkel, Piko bangun, domba pulang, gerbang kandang) diturunkan
 * dari `completedQuests` yang sudah dipersistensikan Fase 1. Nol migrasi.
 */
import { SHEEP } from './mapData';

export const QUEST_01_ID = 'quest_01_bangun_piko';
export const QUEST_02_ID = 'quest_02_domba_tersesat';
export const QUEST_03_ID = 'quest_03_pintu_air';
export const QUEST_04_ID = 'quest_04_urutan_panen';
export const QUEST_05_ID = 'quest_05_konveyor_roti';
export const QUEST_06_ID = 'quest_06_kas_festival';
export const QUEST_07_ID = 'quest_07_jembatan_kristal';
export const QUEST_08_ID = 'quest_08_great_commit';

/**
 * Rantai progresi kanonik desa (Fase 3): urutan quest utama dari awal
 * sampai final. Indeks konten (content/quests/index.ts) wajib menjaga
 * urutan relatif yang sama — dijaga tes di core/progression.test.ts.
 * Helper kuncinya sendiri generik di core/progression.ts.
 */
export const VILLAGE_QUEST_ORDER: readonly string[] = [
  QUEST_01_ID,
  QUEST_02_ID,
  QUEST_03_ID,
  QUEST_04_ID,
  QUEST_05_ID,
  QUEST_06_ID,
  QUEST_07_ID,
  QUEST_08_ID,
];

export interface WorldState {
  /** Q1 selesai: lampu bengkel menyala. */
  workshopLampOn: boolean;
  /** Q1 selesai: Piko bangun dari sudutnya dan mengikuti pemain. */
  pikoAwake: boolean;
  /** Q2 selesai: gerbang kandang tertutup rapat (sebelumnya terbuka rusak). */
  penGateClosed: boolean;
  /** Q2 selesai: ketiga domba kembali ke kandang (sebelumnya tersesat). */
  sheepHome: boolean;
  /** Q3 selesai: pintu air mengalir tertib mengikuti aturan pemain. */
  sluiceFlowing: boolean;
  /** Q3 selesai: ladang desa menghijau lagi (tidak retak kehausan). */
  fieldGreen: boolean;
  /** Q5 selesai: gudang konveyor roti menyala & sabuknya hidup lagi. */
  conveyorRunning: boolean;
  /** Q7 selesai: akar labirin minggir — jalan Jembatan Kristal terbuka. */
  mazeRootsReceded: boolean;
  /** Q8 selesai: Pohon Induk berbunga lagi — The Great Rollback dibatalkan. */
  motherTreeBlooming: boolean;
  /** Wilayah yang sudah diperbaiki, untuk event WORLD_REPAIR. */
  repairedAreas: string[];
}

export function deriveWorldState(completedQuests: readonly string[]): WorldState {
  const done = new Set(completedQuests);
  const q1 = done.has(QUEST_01_ID);
  const q2 = done.has(QUEST_02_ID);
  const q3 = done.has(QUEST_03_ID);
  const q5 = done.has(QUEST_05_ID);
  const q7 = done.has(QUEST_07_ID);
  const q8 = done.has(QUEST_08_ID);
  const repairedAreas: string[] = [];
  if (q1) repairedAreas.push('workshop');
  if (q2) repairedAreas.push('sheep_pen');
  if (q3) repairedAreas.push('sluice');
  if (q5) repairedAreas.push('conveyor_shed');
  if (q7) repairedAreas.push('root_maze');
  if (q8) repairedAreas.push('mother_tree');
  return {
    workshopLampOn: q1,
    pikoAwake: q1,
    penGateClosed: q2,
    sheepHome: q2,
    sluiceFlowing: q3,
    fieldGreen: q3,
    conveyorRunning: q5,
    mazeRootsReceded: q7,
    motherTreeBlooming: q8,
    repairedAreas,
  };
}

/** Wilayah yang BARU diperbaiki antara dua keadaan (untuk WORLD_REPAIR). */
export function newlyRepairedAreas(prev: WorldState, next: WorldState): string[] {
  const before = new Set(prev.repairedAreas);
  return next.repairedAreas.filter((area) => !before.has(area));
}

/** Posisi ubin setiap domba menurut keadaan dunia. */
export function sheepTile(
  state: WorldState,
  sheepName: string,
): { x: number; y: number; flip: boolean } | null {
  const spot = SHEEP.find((s) => s.name === sheepName);
  if (!spot) return null;
  const [x, y] = state.sheepHome ? spot.penTile : spot.lostTile;
  return { x, y, flip: spot.flip };
}

/**
 * Baris petunjuk tujuan di HUD — diturunkan dari progres, suara desa yang
 * hangat, tanpa emoji (aturan rumah).
 */
export function getObjectiveHint(completedQuests: readonly string[]): string {
  const done = new Set(completedQuests);
  if (!done.has(QUEST_01_ID)) {
    return 'Bengkel Kakek gelap sekali… coba periksa pojok bengkel, siapa tahu ada yang tertidur di sana.';
  }
  if (!done.has(QUEST_02_ID)) {
    return 'Piko sudah bangun. Pak Rani di kandang timur kelihatan cemas — dombanya belum pulang.';
  }
  if (!done.has(QUEST_03_ID)) {
    return 'Desa mulai pulih. Cici menunggu di pintu air selatan — kemarau mengancam ladang kalau pintu itu tidak pintar lagi.';
  }
  if (!done.has(QUEST_04_ID)) {
    return 'Bibi Flora ingin catatan panen diurutkan dari yang terberat. Papan catatannya ada di ladang tenggara.';
  }
  if (!done.has(QUEST_05_ID)) {
    return 'Sabuk konveyor roti Cici masih berhenti. Gudang roti di selatan plaza perlu dibangkitkan.';
  }
  if (!done.has(QUEST_06_ID)) {
    return 'Kas Festival Panen belum cocok jumlahnya. Pak Tua Query menunggumu di plaza festival, membawa dua buku besar.';
  }
  if (!done.has(QUEST_07_ID)) {
    return 'Gerbang Akar di timur laut masih menunggu — Jembatan Kristal di baliknya putus sejak Rollback.';
  }
  if (!done.has(QUEST_08_ID)) {
    return 'Semua wilayah pulih kecuali satu: akar Pohon Induk di plaza utara. Sentuh akarnya dan selesaikan The Great Rollback.';
  }
  return 'Desa Bit-Terra pulih sepenuhnya — Pohon Induk berbunga lagi dan kas festival cocok sampai rupiah terakhir. Terima kasih, Fixer.';
}
