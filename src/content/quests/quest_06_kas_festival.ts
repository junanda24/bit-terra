import type { QuestDefinition } from '../../shared/types';

/**
 * Q6 — "Festival Panen Raya" (SQL, HARD, Act 2)
 *
 * Judul kerja di brief cerita: "Misteri Kas Festival". Kas Festival Panen
 * tidak pernah cocok jumlahnya karena catatan setorannya tinggal di satu
 * tabel dan daftar orangnya di tabel lain — pemain belajar JOIN dua tabel
 * plus saringan WHERE bertingkat.
 *
 * Pemberi misi: Pak Tua Query (giverNpcId 'pak_tua_query'), jangkar dunia
 * = plaza festival di selatan.
 *
 * Konsistensi data (WAJIB dijaga kalau seed diubah):
 * - Dua tabel: anggota_festival (6 warga) + kas_festival (10 setoran).
 * - `expectedSqlResult` HARUS sama persis dengan hasil
 *   SELECT a.nama, k.jumlah FROM anggota_festival a
 *   JOIN kas_festival k ON k.anggota_id = a.id
 *   WHERE k.kategori = 'Sewa Stan' AND k.jumlah > 150000
 *   terhadap seed ini — dibuktikan dengan eksekusi sungguhan di
 *   integration-fase3-sql.test.ts (termasuk JOIN implisit sebagai
 *   jawaban alternatif yang sah).
 * - Jebakan yang disengaja: setoran 'Dekorasi' Pak Dulah (300.000) adalah
 *   yang terbesar di buku kas, tapi kategorinya salah; dan setoran Rudi
 *   tepat 150.000 TIDAK ikut — "di atas" berarti lebih dari (>) — keduanya
 *   menghasilkan wrong_result bila saringannya kurang teliti.
 * - sqlSourceTable sengaja 'kas_festival': tabel pertama menurut abjad di
 *   skema adalah 'anggota_festival', jadi pilihan ini membuktikan scanner
 *   mengikuti quest, bukan urutan abjad (jebakan audit SQL-M2).
 */
export const quest06KasFestival: QuestDefinition = {
  id: 'quest_06_kas_festival',
  title: 'Festival Panen Raya',
  act: 2,
  difficulty: 'HARD',
  mode: 'SQL',
  giverNpcId: 'pak_tua_query',
  storyContext:
    'Festival Panen Raya tinggal menghitung minggu, dan kasnya — untuk ketiga kalinya — tidak cocok. Pak Tua Query membuka dua buku besar di meja plaza. "Ini daftar anggota festival," katanya menepuk buku pertama, anggota_festival. "Dan ini buku kasnya, kas_festival. Masalahnya, Nak, buku kas hanya mencatat NOMOR anggota. Siapa menyetor apa, harus digabungkan dari dua buku ini — pekerjaan JOIN, namanya." Ia menurunkan kacamatanya. "Tahun ini kita mulai dari yang paling jelas: penyewa stan. Tampilkan untukku nama dan setoran semua penyetor Sewa Stan yang setorannya di atas seratus lima puluh ribu. Dari situ, kebocorannya akan ketahuan."',
  objectiveText:
    'Gabungkan anggota_festival dan kas_festival: tampilkan nama dan jumlah setoran untuk setoran kategori Sewa Stan yang jumlahnya di atas 150.000.',
  unlockedCartridges: ['SELECT', 'FROM', 'JOIN', 'ON', 'WHERE'],
  initialCode: `-- Buku kas Festival Panen ada di tabel kas_festival, dan daftar
-- anggotanya di tabel anggota_festival. Keduanya terhubung lewat
-- anggota_id. Pak Tua Query ingin tahu: siapa saja penyetor
-- 'Sewa Stan' yang setorannya DI ATAS Rp150.000?

SELECT a.nama, k.___
FROM anggota_festival a
JOIN kas_festival k ON k.___ = a.id
WHERE k.kategori = '___'
  AND k.jumlah > ___;
`,
  sqlSeedScript: `CREATE TABLE anggota_festival (
  id INTEGER PRIMARY KEY,
  nama TEXT,
  dusun TEXT
);

INSERT INTO anggota_festival (id, nama, dusun) VALUES (1, 'Pak Rani', 'Kandang Timur');
INSERT INTO anggota_festival (id, nama, dusun) VALUES (2, 'Bibi Flora', 'Kebun Barat');
INSERT INTO anggota_festival (id, nama, dusun) VALUES (3, 'Cici', 'Bengkel Utara');
INSERT INTO anggota_festival (id, nama, dusun) VALUES (4, 'Sari', 'Tepi Sungai');
INSERT INTO anggota_festival (id, nama, dusun) VALUES (5, 'Pak Dulah', 'Ladang Selatan');
INSERT INTO anggota_festival (id, nama, dusun) VALUES (6, 'Rudi', 'Pasar Pagi');

CREATE TABLE kas_festival (
  id INTEGER PRIMARY KEY,
  anggota_id INTEGER,
  kategori TEXT,
  jumlah INTEGER
);

INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (1, 1, 'Sewa Stan', 200000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (2, 2, 'Sewa Stan', 175000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (3, 3, 'Sewa Stan', 120000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (4, 4, 'Sewa Stan', 250000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (5, 5, 'Dekorasi', 300000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (6, 1, 'Dekorasi', 50000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (7, 3, 'Konsumsi', 90000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (8, 6, 'Sewa Stan', 150000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (9, 2, 'Konsumsi', 60000);
INSERT INTO kas_festival (id, anggota_id, kategori, jumlah) VALUES (10, 4, 'Panggung', 400000);
`,
  expectedSqlResult: [
    { nama: 'Pak Rani', jumlah: 200000 },
    { nama: 'Bibi Flora', jumlah: 175000 },
    { nama: 'Sari', jumlah: 250000 },
  ],
  // Scanner menampilkan buku kas yang sedang diselidiki (SQL-M2) — bukan
  // tabel pertama menurut abjad ('anggota_festival').
  sqlSourceTable: 'kas_festival',
  hints: [
    'Pak Tua Query membuka kedua buku berdampingan: "Buku kas hanya tahu anggota_id, Nak — nomor, bukan nama. Nama tinggal di buku anggota. Hubungkan mereka: FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id. Huruf a dan k itu nama panggilan tabel, biar menulisnya tidak kepanjangan."',
    '"Lalu saring dua kali," lanjut Pak Tua Query. "Pertama kategorinya: k.kategori = \'Sewa Stan\' — setoran Dekorasi Pak Dulah memang besar, tapi itu bukan sewa stan. Kedua jumlahnya: k.jumlah > 150000. Dan hati-hati, Nak: \'di atas\' itu lebih dari. Setoran yang pas 150.000 tidak ikut."',
    'Rangkaian lengkapnya: SELECT a.nama, k.jumlah FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id WHERE k.kategori = \'Sewa Stan\' AND k.jumlah > 150000; — tiga nama akan muncul. Kalau jumlahnya bukan tiga, ada saringan yang bocor.',
  ],
  onSuccessWorldEvents: ['FESTIVAL_CASH_BALANCED', 'STALL_LIST_CLEAR'],
  onFailFunnyReactions: {
    too_many_rows:
      'Daftarnya lebih panjang dari daftar undangan festival. Pak Tua Query menggeleng pelan: "Yang kita cari cuma penyewa stan di atas seratus lima puluh ribu, Nak — tidak lebih dari itu. Ada saringanmu yang bocor: periksa lagi kategorinya, lalu batas jumlahnya. Dan ingat — \'di atas 150.000\' tidak memasukkan setoran yang jumlahnya pas 150.000."',
    no_rows:
      'Hasilnya kosong. Pak Tua Query mengetuk buku kas dua kali, seperti memastikan bukunya tidak tertidur: "Penyewa stan itu ADA, Nak — stan-stan itu tidak menyewa dirinya sendiri. Periksa lagi pasangan JOIN-mu dan nilai yang kamu saring; mungkin nama kategorinya yang tidak persis."',
    wrong_column:
      'Kolomnya belum pas. Pak Tua Query hanya butuh dua hal di daftar ini: nama penyetor (nama, dari buku anggota) dan jumlah setorannya (jumlah, dari buku kas). Kolom lain — dusun, kategori, nomor anggota — biar tinggal di buku masing-masing.',
    wrong_result:
      'Nama-nama yang muncul belum tepat. Ada dua jebakan klasik di buku kas ini, Nak: setoran yang jumlahnya besar tapi kategorinya bukan Sewa Stan, dan setoran yang jumlahnya PAS di batas — "di atas 150.000" berarti lebih dari, bukan sama dengan. Periksa dua saringanmu: kategori DAN jumlah.',
    syntax_error:
      'Cyber-Deck berbunyi "krtk... krtk..." lalu berhenti, seperti dua buku yang ditutup bersamaan terlalu keras. Ada susunan yang kurang pas — baca lagi dari SELECT-nya: pilih kolom, gabungkan tabelnya dengan JOIN ... ON, lalu saring dengan WHERE.',
  },
};
