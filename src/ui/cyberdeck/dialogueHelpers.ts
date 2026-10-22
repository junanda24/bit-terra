import type { LintError } from '../../shared/types';

/**
 * Helper kecil untuk menghidupkan data dialog & world event quest ke layar
 * (temuan playtest F-03): `onSuccessWorldEvents` tidak boleh lagi jadi data
 * mati — kode event diterjemahkan menjadi kalimat perubahan desa yang bisa
 * dibaca pemain.
 */

/** Satu baris tampilan di panel CATATAN PIKO. */
export interface LintDisplayItem {
  text: string;
  suggestion?: string;
}

/** "10 & 13" / "10, 12 & 13" — daftar baris ala bahasa manusia. */
function joinLines(lines: number[]): string {
  if (lines.length <= 2) return lines.join(' & ');
  return `${lines.slice(0, -1).join(', ')} & ${lines[lines.length - 1]}`;
}

/**
 * Ringkas daftar error linter untuk panel CATATAN PIKO (audit layout F):
 * semua blanko (code 'blank') digabung menjadi SATU baris yang menyebut
 * semua barisnya — bukan satu error berulang per baris dengan daftar modul
 * yang sama. Error lain tampil apa adanya, terurut baris, dibatasi maxItems.
 */
export function summarizeLintErrors(errors: LintError[], maxItems = 3): LintDisplayItem[] {
  const blankLines = [
    ...new Set(errors.filter((e) => e.code === 'blank').map((e) => e.line)),
  ].sort((a, b) => a - b);
  const items: LintDisplayItem[] = [];
  if (blankLines.length > 0) {
    items.push({
      text:
        blankLines.length === 1
          ? `Baris ${blankLines[0]} masih ada bagian kosong (___).`
          : `Baris ${joinLines(blankLines)} masih ada bagian kosong (___).`,
      suggestion: 'Klik cartridge di atas editor untuk mengisinya.',
    });
  }
  const others = errors
    .filter((e) => e.code !== 'blank')
    .sort((a, b) => a.line - b.line);
  for (const e of others) {
    items.push({
      text: `Baris ${e.line}: ${e.message}`,
      ...(e.suggestion ? { suggestion: e.suggestion } : {}),
    });
  }
  return items.slice(0, maxItems);
}

const WORLD_EVENT_TEXT: Record<string, string> = {
  PIKO_AWAKENS: 'Piko bangun dan mulai menemanimu',
  WORKSHOP_LIGHT_ON: 'Lampu bengkel menyala lagi',
  SHEEP_SPOTTED: 'Posisi ketiga domba ditemukan',
  SHEEP_RETURN: 'Domba-domba berlari pulang ke kandang',
  HARVEST_RANKED: 'Urutan panen terbaik desa akhirnya jelas',
  FIELDS_TIDIED: 'Baris-baris ladang kembali rapi',
  FESTIVAL_CASH_BALANCED: 'Kas Festival Panen cocok sampai rupiah terakhir',
  STALL_LIST_CLEAR: 'Daftar penyewa stan festival jelas untuk semua warga',
  ROOT_DATABASE_RESTORED: 'Basis data akar Pohon Induk pulih sepenuhnya',
  MOTHER_TREE_BLOOMS: 'Pohon Induk berbunga lagi di tengah desa',
  OMNICLOUD_RETREATS: 'OmniCloud menarik tawarannya dan pergi dengan sopan',
  SLUICE_FLOWS_AGAIN: 'Pintu air mengalir tertib mengikuti aturanmu',
  FIELDS_TURN_GREEN: 'Ladang desa menghijau lagi',
  CONVEYOR_RUNS_AGAIN: 'Ban berjalan gudang roti hidup lagi',
  BREAD_CRATES_LOADED: 'Ketiga peti roti sampai di rak pemuatan',
  MAZE_ROOTS_RECEDE: 'Akar-akar labirin minggir memberi jalan',
  CRYSTAL_BRIDGE_PATH_OPENS: 'Jalan menuju Jembatan Kristal terbuka lagi',
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
