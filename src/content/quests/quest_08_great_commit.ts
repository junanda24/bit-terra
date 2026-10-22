import type { QuestDefinition } from '../../shared/types';

/**
 * Q8 — "Magang di OmniCloud" (HYBRID, HARD, Act 3) — final Bit-Terra.
 *
 * Judul kerja di brief cerita: "The Great Commit". Sepuluh tahun sesudah
 * The Great Rollback, OmniCloud menawarkan "magang" untuk pemain — yang
 * ternyata jalan belakang untuk menyusupkan baris rusak ke tabel
 * sinkronisasi akar Pohon Induk. Final dua fase di Cyber-Deck:
 *
 * FASE 1 (SQL, tulis SAH — sqlWritesAllowed): pemain menyelidiki tabel
 * omni_sync_logs, menemukan baris berstatus 'CORRUPT' susupan OmniCloud,
 * lalu memperbaikinya dengan UPDATE ... WHERE. Verdict BUKAN pada output
 * SELECT pemain, melainkan pada KEADAAN AKHIR tabel
 * (expectedFinalTableState): semua CORRUPT jadi 'SYNCED' DAN baris sehat
 * tidak berubah sedikit pun.
 *
 * FASE 2 (Bot): Piko berjalan menyusuri akar ke terminal kristal dan
 * menyalurkan sinkronisasi terakhir (boot → moveForward → charge di petak
 * terminal). Urutan ditegakkan panggung seperti Q1.
 *
 * Konsistensi data (WAJIB dijaga kalau seed diubah):
 * - Seed 10 baris: 4 'CORRUPT' (id 3, 5, 7, 9), sisanya sehat dengan
 *   status BERAGAM — 'SYNCED', satu 'PENDING' (id 2), satu 'OFFLINE'
 *   (id 6). Keanekaragaman itu disengaja: UPDATE menyeluruh tanpa WHERE
 *   akan menimpa PENDING/OFFLINE dan terdeteksi sebagai innocent_changed.
 * - `expectedFinalTableState` = seed dengan tepat empat baris CORRUPT
 *   berubah jadi 'SYNCED', sisanya identik. Dibuktikan dengan eksekusi
 *   sungguhan di integration-fase3-sql.test.ts, termasuk jebakannya:
 *   UPDATE tanpa WHERE → innocent_changed; perbaikan sebagian →
 *   still_corrupt; DELETE baris rusak → innocent_changed.
 */
export const quest08GreatCommit: QuestDefinition = {
  id: 'quest_08_great_commit',
  title: 'Magang di OmniCloud',
  act: 3,
  difficulty: 'HARD',
  mode: 'HYBRID',
  giverNpcId: 'pak_tua_query',
  storyContext:
    'Seminggu sebelum Festival Panen Raya, sebuah surat berlogo awan tiba di bengkel: OmniCloud Corp menawarkan "magang kehormatan" untukmu — akses penuh ke konsol sinkronisasi mereka, asal desa bersedia "bermigrasi". Pak Tua Query membaca surat itu dua kali, lalu membawamu ke akar Pohon Induk. "Mereka tidak pernah berhenti mencoba, Nak. Dan lihat —" ia menunjuk tabel omni_sync_logs di Cyber-Deck, catatan sinkronisasi perangkat desa ke akar Pohon Induk. Empat barisnya berkedip merah: CORRUPT. "Seseorang sudah menyusup lebih dulu. Magang itu cuma pintu; ini pekerjaannya." Ia meletakkan tangan di akar yang hangat. "Perbaiki datanya di sini, dengan tanganmu sendiri, lalu bangunkan Pohon Induk. Sesudah itu, tidak ada awan yang bisa membeli desa ini."',
  objectiveText:
    'Fase 1: perbaiki tabel omni_sync_logs — ubah semua baris CORRUPT menjadi SYNCED tanpa menyentuh baris sehat. Fase 2: antarkan Piko ke terminal kristal di akar dan salurkan sinkronisasi terakhir.',
  unlockedCartridges: ['SELECT', 'FROM', 'WHERE', 'UPDATE', 'SET'],
  initialCode: `-- Surat "magang" OmniCloud ternyata jalan belakang: seseorang
-- menyusupkan baris rusak ke tabel sinkronisasi akar Pohon Induk.
-- Baris sehat berstatus 'SYNCED' — yang dirusak bertanda 'CORRUPT'.

-- Langkah 1: selidiki dulu. Baris mana saja yang rusak?
SELECT id, perangkat, status FROM omni_sync_logs WHERE status = 'CORRUPT';

-- Langkah 2: perbaiki mereka dengan UPDATE — ubah status baris
-- yang CORRUPT menjadi 'SYNCED'. Hati-hati: baris 'PENDING' dan
-- 'OFFLINE' itu SEHAT dan disengaja begitu. Jangan diubah!
UPDATE omni_sync_logs
SET status = '___'
WHERE status = '___';
`,
  hybridBotInitialCode: `// Data akar sudah bersih. Sekarang giliran Piko: berjalan menyusuri
// akar ke terminal kristal (petak bercahaya) dan menyalurkan
// sinkronisasi terakhir ke Pohon Induk.
// Cartridge fase ini: boot(), moveForward(), charge()

// 1. Nyalakan Piko:
piko.boot()

// 2. Piko mulai di petak (0, 2). Terminal kristal ada di (4, 2),
//    empat petak lurus menyusuri akar. Perintahkan Piko ke sana:
piko.___(4)

// 3. Di petak terminal, salurkan sinkronisasinya:
piko.___()
`,
  hybridBotCartridges: ['boot()', 'moveForward()', 'charge()'],
  hybridPhaseLabels: ['Fase 1 dari 2 — Perbaiki Data', 'Fase 2 dari 2 — Sinkronkan Akar'],
  sqlSeedScript: `CREATE TABLE omni_sync_logs (
  id INTEGER PRIMARY KEY,
  perangkat TEXT,
  zona TEXT,
  status TEXT
);

INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (1, 'Sensor Pintu Air', 'Bendungan', 'SYNCED');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (2, 'Sensor Kelembapan', 'Ladang', 'PENDING');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (3, 'Buku Kas Digital', 'Plaza Festival', 'CORRUPT');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (4, 'Lampu Bengkel', 'Bengkel', 'SYNCED');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (5, 'Gerbang Kandang', 'Kandang', 'CORRUPT');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (6, 'Konveyor Roti', 'Gudang Roti', 'OFFLINE');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (7, 'Termometer Kebun', 'Kebun', 'CORRUPT');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (8, 'Jam Plaza', 'Plaza Festival', 'SYNCED');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (9, 'Sensor Akar', 'Pohon Induk', 'CORRUPT');
INSERT INTO omni_sync_logs (id, perangkat, zona, status) VALUES (10, 'Papan Pengumuman', 'Balai Desa', 'SYNCED');
`,
  expectedFinalTableState: [
    { id: 1, perangkat: 'Sensor Pintu Air', zona: 'Bendungan', status: 'SYNCED' },
    { id: 2, perangkat: 'Sensor Kelembapan', zona: 'Ladang', status: 'PENDING' },
    { id: 3, perangkat: 'Buku Kas Digital', zona: 'Plaza Festival', status: 'SYNCED' },
    { id: 4, perangkat: 'Lampu Bengkel', zona: 'Bengkel', status: 'SYNCED' },
    { id: 5, perangkat: 'Gerbang Kandang', zona: 'Kandang', status: 'SYNCED' },
    { id: 6, perangkat: 'Konveyor Roti', zona: 'Gudang Roti', status: 'OFFLINE' },
    { id: 7, perangkat: 'Termometer Kebun', zona: 'Kebun', status: 'SYNCED' },
    { id: 8, perangkat: 'Jam Plaza', zona: 'Plaza Festival', status: 'SYNCED' },
    { id: 9, perangkat: 'Sensor Akar', zona: 'Pohon Induk', status: 'SYNCED' },
    { id: 10, perangkat: 'Papan Pengumuman', zona: 'Balai Desa', status: 'SYNCED' },
  ],
  // Quest tulis yang sah (Fase 3): tulisan pemain persisten selama sesi
  // deck; verdict membaca keadaan akhir tabel ini (bukan output SELECT).
  sqlWritesAllowed: true,
  sqlSourceTable: 'omni_sync_logs',
  botWorldSetup: {
    gridSize: [6, 5],
    // Terminal kristal di ujung akar.
    targets: [[4, 2]],
    // Bongkahan akar & kristal lepas. Jalur lurus (0,2) -> (4,2) bersih:
    // final tidak boleh gagal karena geometri, hanya karena urutan.
    obstacles: [
      [2, 1],
      [3, 3],
      [5, 0],
      [1, 4],
    ],
  },
  hints: [
    'Pak Tua Query menunjuk baris yang berkedip: "Selidiki dulu sebelum menyentuh apa pun, Nak. SELECT id, perangkat, status FROM omni_sync_logs WHERE status = \'CORRUPT\' — biarkan data mengaku sendiri siapa yang dirusak."',
    '"Perbaikinya pakai UPDATE," lanjut Pak Tua Query. "UPDATE omni_sync_logs SET status = \'SYNCED\' — tapi itu baru setengah kalimat. Tanpa WHERE, SEMUA baris ikut berubah, termasuk Sensor Kelembapan yang memang sedang PENDING dan Konveyor yang sengaja OFFLINE. Mereka itu sehat, Nak. Jangan diutak-atik."',
    'Kalimat lengkapnya: UPDATE omni_sync_logs SET status = \'SYNCED\' WHERE status = \'CORRUPT\'; — empat baris sembuh, enam baris sehat tidak tersentuh. Sesudah itu, antarkan Piko ke terminal kristal di fase dua: boot, moveForward(4), charge.',
  ],
  onSuccessWorldEvents: ['ROOT_DATABASE_RESTORED', 'MOTHER_TREE_BLOOMS', 'OMNICLOUD_RETREATS'],
  onFailFunnyReactions: {
    still_corrupt:
      'Masih ada baris yang berkedip CORRUPT di tabel itu. Pak Tua Query menggeleng pelan: "Belum bersih, Nak. Pohon Induk tidak akan bangun di atas data yang setengah rusak." Jalankan dulu SELECT untuk melihat siapa yang masih rusak, lalu UPDATE tepat ke baris-baris itu — semua yang bertanda CORRUPT, tidak kurang.',
    innocent_changed:
      'Perbaikanmu mengenai baris yang SEHAT. Sensor Kelembapan yang tadinya PENDING dan Konveyor yang sengaja OFFLINE ikut berubah — atau ada baris yang hilang. Pak Tua Query menepuk akar dengan cemas: "Kita memperbaiki desa, bukan menimpanya. Bedakan yang rusak dan yang memang begitu dari sananya." Saring UPDATE-mu dengan WHERE status = \'CORRUPT\' — hanya mereka yang boleh berubah, dan tidak satu pun boleh dihapus.',
    wrong_result:
      'Keadaan akhir tabelnya belum seperti yang diharapkan Pohon Induk. Baca lagi tabelnya dari atas: sepuluh perangkat, empat yang tadinya CORRUPT sekarang SYNCED, dan sisanya persis seperti semula — tidak berubah, tidak bertambah, tidak hilang.',
    syntax_error:
      'Cyber-Deck berbunyi "krtk... krtk..." lalu berhenti. Susunan kalimatmu ada yang kurang pas — baca lagi dari kata pertamanya: SELECT untuk menyelidiki, UPDATE ... SET ... WHERE untuk memperbaiki.',
    wrong_order:
      'Piko mencoba menyalurkan sinkronisasi padahal sistemnya belum dinyalakan. Dari speaker-nya hanya terdengar "tek... tek..." — akar Pohon Induk ikut berdenyut tidak sabar. Selalu mulai dengan boot(), Nak.',
    no_charge:
      'Piko sampai di terminal kristal... lalu diam, karena tidak ada yang menyuruhnya menyalurkan sinkronisasi. Kristalnya berkedip menunggu. Satu perintah terakhir: charge().',
    not_on_target:
      'Piko menyalurkan sinkronisasi di petak akar yang salah — denyutnya memantul ke tanah dan hilang. Terminal kristal hanya menerima penyaluran tepat di petaknya, empat langkah menyusuri akar dari titik awal.',
    hit_obstacle:
      'Piko menabrak bongkahan akar tua dan terduduk terjengkang. Kristal-kristal kecil berjatuhan dari lengkung akar seperti hujan gerimis yang sopan.',
    out_of_bounds:
      'Piko berjalan terlalu jauh dan nyaris terpeleset dari lengkung akar — BRAK! Ia mundur perlahan sambil menggosok antenanya. Jalur akar ini cuma enam petak; terminalnya ada di petak keempat.',
  },
};
