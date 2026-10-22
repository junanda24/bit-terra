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

export interface WorldState {
  /** Q1 selesai: lampu bengkel menyala. */
  workshopLampOn: boolean;
  /** Q1 selesai: Piko bangun dari sudutnya dan mengikuti pemain. */
  pikoAwake: boolean;
  /** Q2 selesai: gerbang kandang tertutup rapat (sebelumnya terbuka rusak). */
  penGateClosed: boolean;
  /** Q2 selesai: ketiga domba kembali ke kandang (sebelumnya tersesat). */
  sheepHome: boolean;
  /** Wilayah yang sudah diperbaiki, untuk event WORLD_REPAIR. */
  repairedAreas: string[];
}

export function deriveWorldState(completedQuests: readonly string[]): WorldState {
  const done = new Set(completedQuests);
  const q1 = done.has(QUEST_01_ID);
  const q2 = done.has(QUEST_02_ID);
  const repairedAreas: string[] = [];
  if (q1) repairedAreas.push('workshop');
  if (q2) repairedAreas.push('sheep_pen');
  return {
    workshopLampOn: q1,
    pikoAwake: q1,
    penGateClosed: q2,
    sheepHome: q2,
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
  return 'Desa mulai pulih: lampu bengkel menyala dan domba sudah di kandang. Wilayah baru menyusul — pintu air dan plaza festival masih menunggu sentuhanmu.';
}
