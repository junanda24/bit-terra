import type { QuestDefinition } from '../../shared/types';

/**
 * Q3 — "Pintu Air Kemarau" (BOT_SCRIPT, MEDIUM, Act 1)
 *
 * Pelajaran: percabangan if/else membaca sensor. Satu setup kering saja
 * akan bisa diakali pemain dengan menulis gate.open() tanpa mikir — maka
 * verdict quest ini berbentuk SKENARIO (botScenarios): skrip yang sama
 * dijalankan ulang dari dunia segar dua kali, sekali tanah kering dan
 * sekali tanah basah, dan aturan pemain harus benar di KEDUA cuaca:
 * - kering (soilMoisture 25): pintu air berakhir TERBUKA;
 * - basah (soilMoisture 85): pintu air berakhir TERTUTUP.
 * Hardcode satu arah pasti gagal di skenario lawannya — itulah bukti
 * pemain benar-benar memakai if/else, bukan menghafal satu jawaban.
 *
 * Panggung: Piko berjalan ke landasan tuas di (5, 2) (targetKind
 * 'platform'), pintu air digambar di (7, 2) dan membuka/menutup mengikuti
 * gate. Jalan lurus y=2 dari (0, 2) ke landasan sengaja bebas rintangan.
 */
export const quest03PintuAir: QuestDefinition = {
  id: 'quest_03_pintu_air',
  title: 'Pintu Air Kemarau',
  act: 1,
  difficulty: 'MEDIUM',
  mode: 'BOT_SCRIPT',
  giverNpcId: 'cici_loops',
  storyContext:
    'Kemarau datang lebih awal tahun ini. Ladang desa mulai retak-retak, sementara pintu air bendungan kecil di selatan macet sejak The Great Rollback — kadang terbuka berhari-hari sampai air terbuang, kadang tertutup rapat saat tanaman menjerit haus. Cici Loops, mekanik desa, sudah lama tahu resepnya: "Pintunya cuma butuh aturan sederhana. Kalau tanah kering, buka. Kalau tanah basah, tutup. If dan else. Yang belum ada cuma orang yang berani menuliskan aturannya." Malam ini Piko jaga di tuas pintu air, dan kamulah yang menulis aturan jaganya.',
  objectiveText:
    'Tulis aturan jaga pintu air untuk Piko: tanah kering (sensor di bawah 40) pintu dibuka, tanah basah pintu ditutup. Aturanmu akan diuji di dua cuaca.',
  unlockedCartridges: ['boot()', 'moveForward()', 'Sensor Tanah', 'if', 'else', 'open()', 'close()'],
  initialCode: `// Musim kemarau. Piko jaga malam di tuas pintu air bendungan,
// dan kamulah yang menulis aturan jaganya.
//
// Aturan desa untuk pintu air:
//   - Tanah KERING (bacaan sensor di bawah 40) -> pintu DIBUKA.
//   - Tanah BASAH  (40 atau lebih)             -> pintu DITUTUP.
// Piko akan diuji dua kali: sekali saat kering, sekali saat basah.
// Aturanmu harus benar di KEDUA cuaca — bukan cuma salah satu.

// 1. Nyalakan Piko, lalu antar dia ke landasan tuas di petak (5, 2):
piko.boot()
piko.moveForward(5)

// 2. Lengkapi aturannya. Bacaan sensor tanah ada di: sensor.soilMoisture
//    Cabang pertama untuk tanah kering, cabang kedua untuk tanah basah.
if (sensor.soilMoisture < 40) {
  gate.___()
} else {
  gate.___()
}
`,
  botWorldSetup: {
    gridSize: [8, 5],
    startPos: [0, 2],
    // Landasan tuas pintu air.
    targets: [[5, 2]],
    targetKind: 'platform',
    // Petak pintu air di tepi timur panggung.
    gateTile: [7, 2],
    // Perabot & batu di sekitar bendungan; jalur y=2 sengaja bebas.
    obstacles: [
      [1, 0],
      [3, 0],
      [2, 1],
      [6, 1],
      [4, 3],
      [6, 3],
      [1, 4],
      [3, 4],
    ],
  },
  botScenarios: [
    {
      label:
        'Uji pertama: matahari terik, tanah kering kerontang. Sensor membaca 25. Aturanmu harus membuka pintu air.',
      setup: { soilMoisture: 25 },
      expected: { gateOpen: true },
      failReactionKey: 'gate_still_closed',
    },
    {
      label:
        'Uji kedua: hujan semalaman, tanah basah kuyup. Sensor membaca 85. Sekarang pintu air harus tertutup rapat.',
      setup: { soilMoisture: 85 },
      expected: { gateOpen: false },
      failReactionKey: 'opened_when_wet',
    },
  ],
  hints: [
    'Cici berbisik sambil menyerahkan kunci inggris: "Pintu air itu tidak butuh perintah yang banyak, Nak. Dia cuma butuh SATU keputusan yang benar: baca sensornya, lalu pilih — buka atau tutup. Keputusan yang berubah mengikuti keadaan namanya percabangan."',
    'Sensor tanah membaca angka 0 sampai 100: makin kecil angkanya, makin kering tanahnya. Aturan desa memakai batas 40 — di bawah 40 berarti kering. Bandingkan bacaan sensor dengan 40 memakai tanda < di dalam if.',
    'Isi persis begini: cabang if diisi gate.open() karena cabang itu untuk tanah kering, dan cabang else diisi gate.close() karena di luar kondisi kering berarti tanah basah. Dua blanko, dua keputusan — lalu tarik tuas RUN dan lihat Piko diuji di dua cuaca.',
  ],
  onSuccessWorldEvents: ['SLUICE_FLOWS_AGAIN', 'FIELDS_TURN_GREEN'],
  onFailFunnyReactions: {
    wrong_order:
      'Piko mencoba menggerakkan tuas pintu air padahal sistemnya belum dinyalakan. Tuasnya cuma berbunyi "krek... krek..." dan Piko menatapnya seperti orang menatap pintu yang dikunci dari dalam. Selalu mulai dengan boot() dulu, ya.',
    gate_still_closed:
      'Tanah sudah retak-retak kehausan, tapi pintu air tetap tertutup rapat. Dari ladang terdengar suara jangkrik yang nadanya seperti protes. Cek lagi: untuk tanah kering, cabang mana yang seharusnya diisi perintah membuka?',
    opened_when_wet:
      'Pintu air dibuka saat tanah sedang basah kuyup — air bendungan tumpah ruah dan ladang berubah jadi kolam renang dadakan. Bebek-bebek desa langsung pindah alamat dengan gembira. Ingat: cuaca basah artinya pintu harus TERTUTUP.',
    hit_obstacle:
      'Piko menabrak tumpukan batu di tepi bendungan dan terduduk. Tuas pintu air memang berat, tapi tidak seberat ini — jalurnya saja yang meleset sedikit.',
    out_of_bounds:
      'Piko berjalan keluar dari area bendungan dan hampir tercebur ke sungai. Cici menariknya kembali sambil menggeleng: "Tuasnya di landasan itu, bukan di tengah sungai."',
    no_charge:
      'Piko berhenti di tengah jalan sebelum sempat mengisi cahaya, dan pintu airnya belum terjamah sama sekali. Jalan terus sampai petak landasan tembaga, ya.',
    not_on_target:
      'Hampir! Tapi Piko berhenti bukan di petak landasan tembaga — sensor dan tuas pintunya menunggu tepat di sana.',
    wrong_result:
      'Pintu air bergerak, tapi tidak sesuai aturan cuaca hari ini. Baca lagi dua cabang aturanmu pelan-pelan: cabang kering dan cabang basah jangan sampai tertukar isinya.',
  },
};
