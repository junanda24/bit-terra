/**
 * Helper kecil untuk menghidupkan data dialog & world event quest ke layar
 * (temuan playtest F-03): `onSuccessWorldEvents` tidak boleh lagi jadi data
 * mati — kode event diterjemahkan menjadi kalimat perubahan desa yang bisa
 * dibaca pemain.
 */

const WORLD_EVENT_TEXT: Record<string, string> = {
  PIKO_AWAKENS: 'Piko bangun dan mulai menemanimu',
  WORKSHOP_LIGHT_ON: 'Lampu bengkel menyala lagi',
  SHEEP_SPOTTED: 'Posisi ketiga domba ditemukan',
  SHEEP_RETURN: 'Domba-domba berlari pulang ke kandang',
};

/** Kode world event → kalimat manusiawi (fallback: rapikan kode mentahnya). */
export function humanizeWorldEvent(code: string): string {
  const known = WORLD_EVENT_TEXT[code];
  if (known) return known;
  const words = code.toLowerCase().replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Gabungan baris "Perubahan di desa" untuk panel sukses. */
export function worldEventsSummary(events: string[]): string {
  return events.map(humanizeWorldEvent).join(' · ');
}
