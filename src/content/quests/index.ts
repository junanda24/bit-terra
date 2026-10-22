import type { QuestDefinition } from '../../shared/types';
import { quest01BangunPiko } from './quest_01_bangun_piko';
import { quest02DombaTersesat } from './quest_02_domba_tersesat';

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
 */
export const ALL_QUESTS: QuestDefinition[] = [
  quest01BangunPiko,
  quest02DombaTersesat,
];

export function getQuestById(id: string): QuestDefinition | undefined {
  return ALL_QUESTS.find((quest) => quest.id === id);
}
