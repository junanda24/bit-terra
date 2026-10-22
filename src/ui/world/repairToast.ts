/**
 * Perayaan WORLD_REPAIR (Fase 4) — logika MURNI di balik toast "desa
 * membaik" di WorldScreen.
 *
 * VillageScene menerbitkan WORLD_REPAIR {area} untuk setiap wilayah yang
 * BARU pulih (worldState.newlyRepairedAreas). Di sini area diterjemahkan
 * menjadi judul manusiawi — memakai ulang pemetaan WORLD_EVENT_TEXT di
 * dialogueHelpers lewat kode event pasangannya — plus satu baris suara
 * Piko. Toast sendiri hidup di WorldScreen: antre, tampil 4,6 detik,
 * tidak mencuri fokus, tidak menghalangi jalan.
 */
import { humanizeWorldEvent } from '../cyberdeck/dialogueHelpers';

/** Berapa lama satu toast tampil sebelum antrean lanjut. */
export const REPAIR_TOAST_MS = 4600;

export interface RepairToastInfo {
  area: string;
  /** Judul manusiawi, dari pemetaan WORLD_EVENT_TEXT dialogueHelpers. */
  title: string;
  /** Satu baris hangat bersuara Piko. */
  pikoLine: string;
}

/** Kode event di WORLD_EVENT_TEXT yang berpasangan dengan tiap area. */
const AREA_EVENT_CODE: Record<string, string> = {
  workshop: 'WORKSHOP_LIGHT_ON',
  sheep_pen: 'SHEEP_RETURN',
  sluice: 'SLUICE_FLOWS_AGAIN',
  conveyor_shed: 'CONVEYOR_RUNS_AGAIN',
  root_maze: 'MAZE_ROOTS_RECEDE',
  mother_tree: 'MOTHER_TREE_BLOOMS',
};

const AREA_PIKO_LINE: Record<string, string> = {
  workshop: 'Piko berkedip senang dari bengkel — sudut tidurnya sekarang hangat.',
  sheep_pen: 'Kriting, Bolang, dan Brintik menghitung diri mereka sendiri. Pas tiga.',
  sluice: 'Dengar itu? Airnya bernyanyi lagi, mengikuti aturan yang kamu tulis.',
  conveyor_shed: 'Gudang roti berdengung lagi. Desa akan sarapan tepat waktu.',
  root_maze: 'Akar-akar itu minggir dengan sopan. Jembatan Kristal menunggu di seberang.',
  mother_tree: 'Piko menyimpan gambar bunga pertama di ingatannya. Untuk Kakek.',
};

const FALLBACK_PIKO_LINE = 'Satu sudut desa pulih lagi berkat tanganmu, Fixer.';

/** Informasi toast untuk satu area; area asing pun dapat fallback sopan. */
export function repairToastInfo(area: string): RepairToastInfo {
  const code = AREA_EVENT_CODE[area];
  const title = code
    ? humanizeWorldEvent(code)
    : humanizeWorldEvent(area.toUpperCase());
  return {
    area,
    title,
    pikoLine: AREA_PIKO_LINE[area] ?? FALLBACK_PIKO_LINE,
  };
}

/**
 * Masukkan area ke antrean toast. Area yang sama tidak diantrekan dua
 * kali (perayaan ganda untuk satu perbaikan hanya jadi kebisingan).
 */
export function enqueueRepair(queue: readonly string[], area: string): string[] {
  if (queue.includes(area)) return [...queue];
  return [...queue, area];
}
