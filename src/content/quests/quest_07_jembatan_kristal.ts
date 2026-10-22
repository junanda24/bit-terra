import type { QuestDefinition } from '../../shared/types';

/**
 * Q7 — "Labirin Akar" (BOT_SCRIPT, HARD, Act 2)
 *
 * Pelajaran: loop bersarang (nested loop) + function. Di balik Gerbang
 * Akar, lorong menuju Jembatan Kristal dipagari akar-akar raksasa yang
 * membentuk koridor cincin 1 petak: empat sisi, dan di setiap sisi
 * tumbuh TIGA tunas akar kristal yang harus disiram supaya lorongnya
 * membuka. Bibi Flora menyebut tunas-tunas itu "anak-anak Pohon Induk".
 *
 * Geometri (grid 8x8, dibuktikan tes dengan solusi rujukan):
 * - Koridor cincin = petak dengan x di {1,6} atau y di {1,6} (di dalam
 *   bingkai 1..6). Bagian dalam (2..5, 2..5) adalah belukar akar padat
 *   (obstacle), bingkai luar (x=0/7, y=0/7) pagar akar (obstacle).
 * - Piko mulai di sudut barat laut (1, 1) menghadap timur.
 * - 12 tanaman: per sisi, tiga petak pertama sesudah sudut adalah
 *   tanaman; petak keempat kosong; petak kelima adalah sudut berikut.
 *   Maka pola per sisi SELALU sama: (langkah + siram) x3, lalu langkah
 *   2 petak, lalu belok kanan — persis satu fungsi, dipanggil loop luar
 *   4 kali. Itulah loop bersarang yang elegan; jalan manual pun bisa.
 *
 * Semantik siram (botStageLogic): piko.water() menyiram tanaman di
 * PETAK PIKO BERDIRI. Melangkah ke petak tanaman itu boleh dan memang
 * caranya — hadap hanya mengatur gerak & belok, bukan target siram.
 */

const RING_OBSTACLES: [number, number][] = (() => {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const push = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([x, y]);
  };
  // Pagar akar di bingkai luar.
  for (let i = 0; i < 8; i++) {
    push(i, 0);
    push(i, 7);
    push(0, i);
    push(7, i);
  }
  // Belukar akar padat di bagian dalam cincin.
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 5; y++) push(x, y);
  }
  return out;
})();

export const quest07JembatanKristal: QuestDefinition = {
  id: 'quest_07_jembatan_kristal',
  title: 'Labirin Akar',
  act: 2,
  difficulty: 'HARD',
  mode: 'BOT_SCRIPT',
  giverNpcId: 'bibi_flora',
  storyContext:
    'Di timur laut desa, dua akar raksasa melengkung membentuk Gerbang Akar — jalan lama menuju Jembatan Kristal dan tambang di seberangnya, putus sejak The Great Rollback. Di balik gerbang, akar-akar Pohon Induk tumbuh liar membentuk labirin koridor sempit, dan di sepanjang koridornya tumbuh dua belas tunas akar kristal yang layu kehausan. Bibi Flora berlutut menyentuh salah satunya dengan lembut: "Tunas-tunas ini kunci lorongnya, Nak. Siram semuanya, dan akar yang tua-tua akan minggir memberi jalan — Pohon Induk selalu membalas yang merawat anaknya." Dua belas tunas, empat sisi labirin, tiga tunas per sisi. Pola di dalam pola. Bibi Flora tersenyum: "Kau tahu ini pekerjaan apa, kan?"',
  objectiveText:
    'Siram kedua belas tunas akar kristal di labirin akar. Empat sisi koridor, tiga tunas di setiap sisi — temukan pola di dalam polanya.',
  unlockedCartridges: ['boot()', 'moveForward()', 'Kompas Akar', 'turnLeft()', 'turnRight()', 'water()', 'for', 'function'],
  initialCode: `// Labirin Akar: koridor cincin sempit di balik Gerbang Akar.
// Di sepanjang koridor tumbuh 12 tunas akar kristal yang layu.
// Siram SEMUANYA, dan akar tua akan minggir memberi jalan.
//
// Polanya: koridor ini punya 4 sisi. Di setiap sisi ada 3 tunas:
// tunas-tunas itu tumbuh di 3 petak pertama sesudah sudut.
// Di ujung tiap sisi, Piko harus belok — Kompas Akar (turnRight)
// yang Cici pasang kemarin akan membantumu berbelok.
//
// Siram dengan water() SAAT PIKO BERDIRI DI PETAK TUNASNYA.

// 1. Nyalakan Piko:
piko.boot()

// 2. Satu sisi labirin = satu pola yang sama:
//    (melangkah ke tunas lalu siram) 3 kali, lalu melangkah
//    2 petak sampai sudut berikutnya.
function siramSisi() {
  for (let i = 0; i < ___; i++) {
    piko.moveForward(1)
    piko.___()
  }
  piko.moveForward(2)
}

// 3. Ulangi pola sisi itu untuk keempat sisi labirin,
//    berbelok di setiap sudutnya:
for (let sisi = 0; sisi < ___; sisi++) {
  siramSisi()
  piko.___()
}
`,
  botWorldSetup: {
    gridSize: [8, 8],
    startPos: [1, 1],
    // Quest ini tidak memakai petak target robot/peti — tujuannya
    // adalah tanaman. Panggung menggambar tanaman dari field `plants`.
    targets: [],
    // 12 tunas akar kristal: 3 pertama sesudah tiap sudut koridor.
    plants: [
      // Sisi utara (jalan ke timur dari sudut (1,1)).
      [2, 1],
      [3, 1],
      [4, 1],
      // Sisi timur (jalan ke selatan dari sudut (6,1)).
      [6, 2],
      [6, 3],
      [6, 4],
      // Sisi selatan (jalan ke barat dari sudut (6,6)).
      [5, 6],
      [4, 6],
      [3, 6],
      // Sisi barat (jalan ke utara dari sudut (1,6)).
      [1, 5],
      [1, 4],
      [1, 3],
    ],
    obstacles: RING_OBSTACLES,
  },
  hints: [
    'Bibi Flora menggambar di tanah dengan ranting: "Satu lingkaran penuh, Nak. Empat sisi. Tiga tunas di tiap sisi, selalu di tiga petak pertama sesudah sudut. Kalau polanya sama di semua sisi, kau tidak perlu menulis dua belas perintah siram — cukup satu pola sisi, diulang empat kali."',
    'Hitung langkah di satu sisi: dari sudut, tunas ada di petak ke-1, ke-2, dan ke-3. Petak ke-4 kosong, petak ke-5 sudah sudut berikutnya. Jadi di dalam fungsi sisi: loop 3 kali (maju 1, siram), lalu maju 2 petak, selesai. Beloknya di luar fungsi, di loop besar.',
    'Rangkaian lengkapnya: boot(), lalu loop luar 4 kali — di dalamnya panggil siramSisi() lalu turnRight(). Di dalam siramSisi(): loop 3 kali berisi moveForward(1) lalu water(), ditutup moveForward(2). Dua loop, satu di dalam yang lain: itulah loop bersarang.',
  ],
  onSuccessWorldEvents: ['MAZE_ROOTS_RECEDE', 'CRYSTAL_BRIDGE_PATH_OPENS'],
  onFailFunnyReactions: {
    wrong_order:
      'Piko menyiram sambil tertidur — airnya muncrat ke atas dan jatuh menimpa kepalanya sendiri seperti hujan lokal. Ia bangun dengan antena basah dan ekspresi bingung. boot() dulu, baru menyiram.',
    plants_dry:
      'Masih ada tunas yang layu belum tersiram. Piko memutar memutar peta labirin buatannya sendiri — gambarnya cuma lingkaran dan tanda tanya. Cek tiap sisi: tiga tunas per sisi, dua belas semuanya.',
    watered_empty:
      'Piko rajin menyiram... petak kosong. Genangan air di lantai koridor sekarang cukup untuk memantulkan wajah bingungnya sendiri. Tunas hanya tersiram kalau Piko BERDIRI DI PETAK TUNAS ITU saat memanggil water().',
    hit_obstacle:
      'DUGH! Piko menabrak akar raksasa dan terduduk di koridor. Akar itu bahkan tidak bergeming — akar yang lebih tua dari desa memang tidak wajib sopan. Hitung lagi belokanmu di sudut-sudut labirin.',
    out_of_bounds:
      'Piko mencoba berjalan menembus pagar akar di bingkai labirin. Pagarnya diam saja; yang mundur Piko-nya. Koridor cincin adalah satu-satunya jalan — ikuti melingkar.',
    wrong_result:
      'Lorongnya belum membuka. Ada yang belum pas dengan putaran sirammu — mungkin jumlah tunas per sisi, mungkin jumlah sisi yang sudah kau kelilingi. Gambar lagi cincinnya pelan-pelan: 4 sisi, 3 tunas per sisi.',
  },
};
