import type { QuestDefinition } from '../../shared/types';
import { quest01BangunPiko } from './quest_01_bangun_piko';
import { quest02DombaTersesat } from './quest_02_domba_tersesat';
import { quest03PintuAir } from './quest_03_pintu_air';
import { quest04UrutanPanen } from './quest_04_urutan_panen';
import { quest05KonveyorRoti } from './quest_05_konveyor_roti';
import { quest06KasFestival } from './quest_06_kas_festival';
import { quest07JembatanKristal } from './quest_07_jembatan_kristal';
import { quest08GreatCommit } from './quest_08_great_commit';

/**
 * Registry konten quest — satu-satunya pintu masuk modul lain ke data quest
 * (BLUEPRINT §3 aturan 2: data-driven, tanpa `if (questId === ...)` tersebar).
 * Quest baru = file baru di folder ini + satu baris impor di bawah.
 *
 * CATATAN VERIFIKASI INTEGRASI (Fase 1): untuk setiap quest mode SQL,
 * `expectedSqlResult` HARUS dapat diturunkan dari `sqlSeedScript`-nya —
 * bukan sekadar diketik mirip. Pass integrasi wajib membuktikannya dengan
 * benar-benar menjalankan seed di sql.js (SqliteWasmRunner.init(seed)) lalu
 * menjalankan query rujukan blueprint dan membandingkan result set-nya
 * dengan `expectedSqlResult` via ResultDiffChecker. Q2 saat ini terverifikasi
 * manual baris-per-baris: seed 12 baris, tepat 3 berstatus 'LOST'
 * (Kriting/Tepi Sungai, Bolang/Dekat Bendungan, Brintik/Kebun Bibi Flora),
 * dan expectedSqlResult di quest_02 sama persis dengan ketiga baris itu.
 *
 * CATATAN FASE 3 (Tahap C1): quest_04, quest_06, dan quest_08 dibuktikan
 * dengan pola yang sama di src/integration-fase3-sql.test.ts — seed
 * dijalankan di sql.js sungguhan, query solusi dibandingkan dengan
 * expected (Q4 per posisi, Q6 sebagai himpunan, Q8 pada keadaan akhir
 * tabel sesudah UPDATE), jebakan-jebakannya dibuktikan GAGAL.
 */
export const ALL_QUESTS: QuestDefinition[] = [
  quest01BangunPiko,
  quest02DombaTersesat,
  // Fase 3 lengkap: Q3/Q5/Q7 (bot, Tahap C2) menyela di posisi
  // numeriknya di antara Q4 + Q6 (SQL) dan final HYBRID Q8 (Tahap C1) —
  // urutan array ini = urutan rantai progresi (core/progression.ts).
  quest03PintuAir,
  quest04UrutanPanen,
  quest05KonveyorRoti,
  quest06KasFestival,
  quest07JembatanKristal,
  quest08GreatCommit,
];

export function getQuestById(id: string): QuestDefinition | undefined {
  return ALL_QUESTS.find((quest) => quest.id === id);
}
