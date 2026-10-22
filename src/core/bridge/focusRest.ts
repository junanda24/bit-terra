import { useGameStore } from './gameStore';

/**
 * Istirahat Fokus di desa (balance pass Fase 4 — menutup temuan ekonomi
 * "soft-strand"): sebelum pass ini, satu-satunya jalan memulihkan fokus
 * adalah +20 dari menuntaskan quest — persis quest yang sedang membuat
 * pemain terjebak. Tidak ada gerbang keras di fokus 0 (RUN tidak pernah
 * dikunci fokus), tetapi pemain yang berjuang lama terparkir di bar
 * merah tanpa jalan pulang selain sukses itu sendiri.
 *
 * Logika stamina ala Harvest Moon: selama pemain berada DI DESA (deck
 * tertutup, `codingMode === false`), fokus pulih pelan-pelan sampai
 * BATAS ISTIRAHAT. Batas itu sengaja jauh di bawah yang bisa diberikan
 * quest (maks 100): istirahat mengembalikanmu ke "cukup segar untuk
 * mencoba lagi", bukan menggantikan rasa pencapaian menuntaskan misi.
 *
 * Angka: +2 per 5 detik = +24/menit; dari 0 ke batas 50 perlu ±2 menit
 * berkeliling desa — kira-kira satu putaran desa sambil menyapa NPC,
 * dan pemain melihat bar bergerak naik setiap beberapa detik.
 */
export const FOCUS_REST_CAP = 50;
export const FOCUS_REST_PER_TICK = 2;
export const FOCUS_REST_TICK_MS = 5000;

/**
 * Fokus sesudah `ticks` ketukan istirahat. Di atas batas istirahat,
 * nilainya tidak bergerak (istirahat tidak menguras fokus yang didapat
 * dari quest, dan tidak menaikkannya lebih jauh).
 */
export function restedFocus(current: number, ticks = 1): number {
  if (current >= FOCUS_REST_CAP) return current;
  return Math.min(FOCUS_REST_CAP, current + FOCUS_REST_PER_TICK * ticks);
}

/**
 * Satu ketukan istirahat terhadap store sungguhan. No-op (false) saat
 * deck terbuka (pemain sedang ngoding, bukan beristirahat) atau saat
 * fokus sudah di/atas batas istirahat. Mengembalikan true bila fokus
 * benar-benar berubah.
 */
export function tickFocusRest(): boolean {
  const store = useGameStore.getState();
  if (store.codingMode) return false;
  const next = restedFocus(store.focus);
  if (next === store.focus) return false;
  store.setFocus(next);
  return true;
}
