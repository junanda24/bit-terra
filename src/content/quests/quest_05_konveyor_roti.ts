import type { QuestDefinition } from '../../shared/types';

/**
 * Q5 — "Ban Berjalan Roti" (BOT_SCRIPT, MEDIUM, Act 2)
 *
 * (Label tugas menyebut "Pak Rani", tetapi gudang konveyor di dunia —
 * peta, dialog, dan brief cerita — adalah gudang roti CICI LOOPS; quest
 * ini mengikuti data dunia supaya cerita dan peta tidak bertengkar.)
 *
 * Pelajaran: loop `for` (ditambah function sebagai pembungkus pola).
 * Mekanik baru: PETI DORONG (Sokoban-lite). Melangkah ke petak peti
 * mendorongnya satu petak searah hadap robot, bila petak sesudahnya
 * bebas — bukan dinding, bukan batas grid, bukan peti lain, bukan
 * tanaman. Tiga peti roti, tiga jalur lurus (y=1, 2, 3): peti mulai di
 * x=3, bintang tujuan di x=7 — tepat EMPAT dorongan per peti, jadi pola
 * "dorong 4 kali" wajar ditulis sebagai satu fungsi ber-loop dan
 * dipanggil tiga kali. Koridor barat (x=0..1) dan koridor timur
 * (x=8..9) selalu bebas: setiap peti bisa didekati dari belakang
 * (sisi baratnya) kapan pun, jadi tidak ada kunci mati permanen —
 * peti yang terdorong sampai menempel tepi grid di luar target memang
 * tidak bisa diselamatkan (box_stuck), tapi setiap RUN mulai segar.
 *
 * Kompas (turnLeft/turnRight) debut di quest ini: tiga jalur menuntut
 * Piko berpindah baris, dan jalur tengah hanya pemanasan lurus.
 */
export const quest05KonveyorRoti: QuestDefinition = {
  id: 'quest_05_konveyor_roti',
  title: 'Ban Berjalan Roti',
  act: 2,
  difficulty: 'MEDIUM',
  mode: 'BOT_SCRIPT',
  giverNpcId: 'cici_loops',
  storyContext:
    'Gudang roti Cici Loops punya ban berjalan tua yang berhenti total sejak The Great Rollback — dan tiga peti roti terakhir masih teronggok di tengah gudang, jauh dari rak pemuatan berbintang di sisi timur. Festival Panen Raya butuh roti-roti itu besok pagi. Cici mengangkat bahu sambil mengelap tangan ke celemeknya: "Sabuknya sih bisa kunyalakan lagi. Tapi petinya harus didorong satu-satu ke raknya, dan punggungku sudah protes duluan. Piko kuat, Piko tidak protes. Kamu yang jadi otaknya, ya." Anehnya, jarak tiap peti ke raknya persis sama: empat dorongan. Pola yang sama, tiga kali. Kedengarannya seperti pekerjaan untuk sebuah loop.',
  objectiveText:
    'Dorong ketiga peti roti ke petak berbintang di sisi timur gudang. Setiap peti berjarak tepat empat dorongan dari raknya.',
  unlockedCartridges: ['boot()', 'moveForward()', 'turnLeft()', 'turnRight()', 'for', 'function'],
  initialCode: `// Gudang roti Cici. Tiga peti roti teronggok di tengah gudang,
// dan rak pemuatan berbintang menunggu di sisi timur.
// Setiap peti berjarak TEPAT 4 dorongan dari raknya — pola yang
// sama berulang, dan pola berulang adalah pekerjaan loop.
//
// Aturan mendorong: kalau Piko melangkah ke petak peti, petinya
// ikut bergeser satu petak searah langkah Piko (kalau jalannya
// bebas). Berdiri di BELAKANG peti (sisi baratnya), lalu dorong.

// 1. Nyalakan Piko:
piko.boot()

// 2. Satu fungsi untuk pola yang berulang: dorong 4 kali.
//    Peti didorong setiap Piko melangkah maju ke arahnya.
function dorongSampaiRak() {
  for (let i = 0; i < ___; i++) {
    piko.moveForward(1)
  }
}

// 3. Jalur tengah dulu: Piko mulai di (0, 2), tepat di jalur ini.
//    Jalan 2 petak sampai berdiri di belakang petinya, lalu dorong:
piko.moveForward(2)
dorongSampaiRak()

// 4. Dua peti lagi menunggu di jalur atas (y=1) dan bawah (y=3).
//    Koridor barat (kolom x=0 dan x=1) selalu bebas — pakai koridor
//    itu untuk berpindah jalur dan mendekati tiap peti dari belakang.
//    Belok dengan turnLeft() / turnRight(). Selamat mendorong!
`,
  botWorldSetup: {
    gridSize: [10, 6],
    startPos: [0, 2],
    // Bintang rak pemuatan — tujuan PETI, bukan tujuan robot.
    targets: [
      [7, 1],
      [7, 2],
      [7, 3],
    ],
    targetKind: 'marker',
    // Tiga peti roti, satu per jalur, masing-masing 4 dorongan dari rak.
    boxes: [
      [3, 1],
      [3, 2],
      [3, 3],
    ],
    // Perabot gudang di luar jalur dorong; koridor barat (x=0..1),
    // koridor timur (x=8..9), dan ketiga jalur sengaja dibiarkan bebas.
    obstacles: [
      [4, 0],
      [6, 0],
      [3, 4],
      [7, 4],
      [5, 5],
    ],
  },
  hints: [
    'Cici menepuk peti terdekat: "Satu peti, empat dorongan. Tiga peti, tetap empat dorongan — yang berubah cuma jalurnya. Kalau sebuah pola sama persis berulang, tulis sekali sebagai function, panggil berkali-kali. Itulah gunanya loop dan fungsi, Nak."',
    'Blanko di dalam loop for itu angka 4: tiap peti butuh tepat empat langkah maju untuk sampai ke bintang. Setelah jalur tengah beres, Piko ada di (6, 2). Untuk jalur lain: belok dua kali sampai menghadap barat, jalan menyusuri jalur sampai kolom x=0, lalu belok ke jalur berikutnya dan dekati petinya dari belakang.',
    'Rangkaian lengkap untuk satu peti dari koridor barat: berhenti di (2, y) — tepat di belakang peti — lalu panggil dorongSampaiRak(). Peti meluncur 4 petak ke bintang di (7, y) dan Piko berhenti di (6, y). Ulangi pola posisi yang sama untuk y=1 dan y=3.',
  ],
  onSuccessWorldEvents: ['CONVEYOR_RUNS_AGAIN', 'BREAD_CRATES_LOADED'],
  onFailFunnyReactions: {
    wrong_order:
      'Piko mendorong peti sambil tertidur — petinya tidak bergeser seinci pun, tapi Piko bermimpi sedang memindahkan seluruh gudang. Bangunkan dulu dengan boot(), baru mendorong.',
    boxes_incomplete:
      'Ada peti yang belum sampai ke bintang raknya. Piko berputar mengecek satu-satu dengan senter kecilnya. Peti yang sudah di bintang jangan didorong lagi — nanti malah lewat. Cek jalur y=1, y=2, dan y=3 satu per satu.',
    box_stuck:
      'Satu peti terdorong sampai menempel ke tepi gudang, jauh dari bintangnya — dari sana tidak ada yang bisa menariknya kembali. Untung setiap percobaan mulai dari awal: dorong peti hanya sejauh bintangnya, jangan sampai kelewatan.',
    hit_obstacle:
      'BRAK! Piko menabrak perabot gudang dan peti di depannya ikut bergetar protes. Di gudang sempit begini, belokan memang harus dihitung pelan-pelan.',
    out_of_bounds:
      'Piko berjalan sampai ke batas gudang dan menabrak dinding papan. Cici mengetuk dinding itu dari luar: "Yang ini dinding beneran, bukan pintu."',
    wrong_result:
      'Gudang masih belum rapi menurut daftar muatan Cici. Hitung lagi dorongan tiap peti: dari x=3 ke bintang di x=7 itu tepat empat kali melangkah maju, tidak kurang, tidak lebih.',
  },
};
