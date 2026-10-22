/**
 * Progresi berurutan Bit-Terra (Fase 3) — helper MURNI, tanpa state.
 *
 * Keputusan desain (membalik F-11 Fase 1 atas permintaan user "gimana cara
 * nampilin next level"): quest terbuka BERURUTAN mengikuti urutan indeks
 * konten. Quest ke-n terbuka bila semua quest sebelumnya di urutan itu
 * sudah selesai. Quest yang SUDAH selesai selalu bisa dimainkan ulang —
 * aturan ini juga membuat save lama tetap masuk akal: save dengan Q1+Q2
 * selesai mendarat persis di Q3 terbuka, sisanya terkunci.
 *
 * Helper ini sengaja tidak tahu judul quest: pemanggil (picker / jembatan
 * dunia) menerjemahkan id penghalang menjadi judul dari indeks konten.
 */

/** Indeks quest di dalam urutan rantai (-1 bila tidak dikenal). */
export function questOrderIndex(
  orderedIds: readonly string[],
  questId: string,
): number {
  return orderedIds.indexOf(questId);
}

/**
 * Apakah quest ini boleh dibuka?
 * - Quest yang sudah selesai: selalu boleh (main ulang itu hak pemain).
 * - Quest pertama di rantai: selalu boleh.
 * - Quest lain: boleh bila SEMUA pendahulunya sudah selesai.
 * - Quest di luar rantai yang dikenal: bukan urusan helper ini → boleh
 *   (konten eksperimental tidak boleh terkunci oleh rantai utama).
 */
export function isQuestUnlocked(
  questId: string,
  orderedIds: readonly string[],
  completedQuests: readonly string[],
): boolean {
  if (completedQuests.includes(questId)) return true;
  const idx = questOrderIndex(orderedIds, questId);
  if (idx <= 0) return true;
  const done = new Set(completedQuests);
  for (let i = 0; i < idx; i++) {
    if (!done.has(orderedIds[i])) return false;
  }
  return true;
}

/**
 * Id quest PERTAMA yang belum selesai dan menghalangi quest ini — yang
 * harus diselesaikan pemain lebih dulu. null bila tidak ada penghalang
 * (quest terbuka, sudah selesai, atau di luar rantai).
 */
export function lockBlockerId(
  questId: string,
  orderedIds: readonly string[],
  completedQuests: readonly string[],
): string | null {
  if (isQuestUnlocked(questId, orderedIds, completedQuests)) return null;
  const idx = questOrderIndex(orderedIds, questId);
  const done = new Set(completedQuests);
  for (let i = 0; i < idx; i++) {
    if (!done.has(orderedIds[i])) return orderedIds[i];
  }
  return null;
}

/** Quest berikutnya yang belum selesai menurut urutan rantai (null = tamat). */
export function nextQuestId(
  orderedIds: readonly string[],
  completedQuests: readonly string[],
): string | null {
  const done = new Set(completedQuests);
  for (const id of orderedIds) {
    if (!done.has(id)) return id;
  }
  return null;
}
