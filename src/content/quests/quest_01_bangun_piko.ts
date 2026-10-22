import type { QuestDefinition } from '../../shared/types';

/**
 * Q1 — "Bangun, Piko!" (BOT_SCRIPT, EASY, Act 1)
 *
 * Misi pertama pemain: menghidupkan kembali Piko, robot pendamping Kakek,
 * yang tertidur di pojok bengkel sejak The Great Rollback.
 *
 * Konvensi botWorldSetup untuk misi bot (dipakai juga misi-misi berikutnya):
 * - Grid dihitung [x, y]: x = kolom 0..lebar-1 (kiri ke kanan),
 *   y = baris 0..tinggi-1 (atas ke bawah).
 * - Posisi awal robot TIDAK disimpan di QuestDefinition; secara konvensi
 *   robot selalu mulai di petak (0, 2) — sudut kiri, baris tengah — dan
 *   menghadap ke kanan (arah +x). Engine/visualizer membaca konvensi ini.
 * - `targets` = petak tujuan yang harus dicapai robot. Untuk Q1: petak
 *   cahaya matahari di lantai bengkel, satu-satunya sumber isi daya Piko.
 * - `obstacles` = petak yang tidak bisa dilewati (perabot bengkel).
 *   Jalur lurus (0,2) -> (1,2) -> (2,2) -> (3,2) sengaja dibiarkan kosong:
 *   misi pertama tidak boleh gagal karena geometri, hanya karena urutan
 *   perintah — itu pelajaran yang ingin diajarkan misi ini.
 */
export const quest01BangunPiko: QuestDefinition = {
  id: 'quest_01_bangun_piko',
  title: 'Bangun, Piko!',
  act: 1,
  difficulty: 'EASY',
  mode: 'BOT_SCRIPT',
  giverNpcId: 'grandpa_note',
  storyContext:
    'Kamu baru tiba di bengkel warisan Kakek di Bit-Terra. Di pojok ruangan yang berdebu, tertutup selimut tua, ada Piko — robot pendamping Kakek yang sudah tertidur sejak The Great Rollback sepuluh tahun lalu. Baterai suryanya kosong melompong. Satu-satunya petak lantai yang tersentuh cahaya matahari pagi ada tiga petak dari tempatnya berbaring, dan di samping kepalanya ada catatan tulisan tangan Kakek: "Kalau aku sudah tidak ada, tolong bangunkan dia. Dia benci gelap, sama seperti kakeknya."',
  objectiveText:
    'Bangunkan Piko: nyalakan sistemnya, perintahkan ia berjalan ke petak cahaya matahari, lalu isi dayanya sampai penuh.',
  unlockedCartridges: ['boot()', 'moveForward()', 'charge()'],
  initialCode: `// Piko tertidur di pojok bengkel yang gelap. Baterai suryanya kosong.
// Beri dia perintah satu per satu, dari atas ke bawah.
// Cartridge yang kamu punya: boot(), moveForward(), charge()

// 1. Nyalakan dulu sistem Piko (baris ini sudah terpasang sebagai contoh):
piko.boot()

// 2. Piko mulai di petak (0, 2). Petak cahaya matahari ada di (3, 2),
//    tepat 3 petak lurus di depannya. Perintahkan Piko berjalan ke sana:
piko.___(3)

// 3. Begitu Piko sampai di petak cahaya, isi dayanya sampai penuh:
piko.___()
`,
  botWorldSetup: {
    gridSize: [8, 5],
    // Petak cahaya matahari di lantai bengkel.
    targets: [[3, 2]],
    // Perabot bengkel: meja kerja, tumpukan kayu bakar, drum tua, kursi
    // patah, rak perkakas. Tidak satu pun menghalangi jalur lurus Piko.
    obstacles: [
      [1, 0],
      [3, 0],
      [2, 1],
      [5, 1],
      [7, 2],
      [4, 3],
      [6, 4],
      [1, 4],
    ],
  },
  hints: [
    'Catatan Kakek yang menempel di meja kerja: "Piko tidak bisa bergerak sebelum sistemnya dinyalakan. Apa pun yang kau lakukan, selalu mulai dengan boot(). Urutan perintah itu penting, Nak."',
    'Layar kecil Piko berkedip lemah, menampilkan peta bengkel: Piko di petak (0, 2), petak cahaya di (3, 2). Jaraknya pas tiga petak lurus ke depan — dan moveForward menerima angka jumlah petak yang harus dilangkahi.',
    'Tulis persis tiga baris, berurutan: piko.boot() untuk menyalakan, piko.moveForward(3) untuk berjalan ke petak cahaya, lalu piko.charge() untuk mengisi daya. Setelah itu tarik tuas RUN dan tonton dia melangkah satu per satu.',
  ],
  onSuccessWorldEvents: ['PIKO_AWAKENS', 'WORKSHOP_LIGHT_ON'],
  onFailFunnyReactions: {
    out_of_bounds:
      'Piko berjalan terlalu jauh dan menabrak pagar kayu bengkel — BRAK! Bintang-bintang kecil berputar di atas kepalanya, dan ia mundur perlahan dengan langkah malu-malu.',
    no_charge:
      'Piko sampai di petak cahaya... lalu diam mematung, karena tidak ada yang menyuruhnya mengisi daya. Sinar matahari pagi yang hangat itu cuma jadi latar foto untuknya.',
    wrong_order:
      'Piko mencoba mengisi daya padahal sistemnya belum dinyalakan. Dari speaker-nya hanya terdengar bunyi "tek... tek..." pelan, seperti orang mengigau minta dibangunkan dengan benar.',
    hit_obstacle:
      'Piko menabrak tumpukan kayu bakar dan terduduk terjengkang. Selembar daun kering mendarat persis di antenanya, seperti topi yang terlalu kecil.',
    not_on_target:
      'Piko berhenti dan mengisi daya di petak yang gelap gulita — layar kecilnya berpendar sendirian seperti kunang-kunang kesepian, tapi baterainya tetap kosong melompong. Sinar matahari pagi cuma ada di petak cahaya itu; di luar petak itu, mengisi daya berapa lama pun tidak akan pernah penuh.',
  },
};
