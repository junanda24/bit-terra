import type { QuestDefinition } from '../../shared/types';

/**
 * Q4 — "Teras Sawah" (SQL, MEDIUM, Act 2)
 *
 * Judul kerja di brief cerita: "Urutan Panen Terbaik". Bibi Flora ingin
 * tahu tiga panen terberat musim Kemarau — pemain belajar ORDER BY + LIMIT
 * (dengan saringan WHERE musim dari Q2 sebagai pemanasan).
 *
 * Pemberi misi: Bibi Flora (giverNpcId 'bibi_flora'), jangkar dunia =
 * papan catatan di ladang tenggara.
 *
 * Konsistensi data (WAJIB dijaga kalau seed diubah):
 * - Seed 12 baris: 8 Kemarau, 4 Hujan. Tiga terberat Kemarau BERURUTAN:
 *   Pak Dulah/Padi 96, Pak Dulah/Kedelai 91, Cici/Jagung 84 — dan
 *   `expectedSqlResult` di bawah HARUS sama persis dengan hasil
 *   SELECT petani, tanaman, berat_kg FROM panen_logs
 *   WHERE musim = 'Kemarau' ORDER BY berat_kg DESC LIMIT 3.
 *   Dibuktikan dengan eksekusi sungguhan di integration-fase3-sql.test.ts.
 * - Batas potong (peringkat 3 vs 4) SENGAJA bebas seri (84 vs 77): seri di
 *   batas LIMIT akan membuat urutan jawaban yang benar jadi ambigu dan
 *   tidak adil dinilai per posisi. Seri tetap ada di tempat aman: dua
 *   baris 77 kg di Kemarau (di bawah potong) dan dua baris 88 kg di Hujan.
 * - Jebakan yang disengaja: panen Hujan terberat (88) mengalahkan peringkat
 *   3 Kemarau — lupa WHERE musim = jawaban salah (wrong_result).
 */
export const quest04UrutanPanen: QuestDefinition = {
  id: 'quest_04_urutan_panen',
  title: 'Teras Sawah',
  act: 2,
  difficulty: 'MEDIUM',
  mode: 'SQL',
  giverNpcId: 'bibi_flora',
  storyContext:
    'Musim panen sudah lewat, tapi papan pengumuman di balai desa masih kosong — dan para petani mulai berdebat siapa yang panennya paling berat musim Kemarau ini. "Dulah bilang padinya," kata Bibi Flora sambil membuka buku catatan panen desa yang halamannya masih acak sejak The Great Rollback, "Rani bilang singkongnya, Cici tertawa saja sambil menunjuk jagungnya. Bertengkar pakai ingatan itu tidak ada habisnya, Nak." Ia menepuk tabel panen_logs di Cyber-Deck. "Data tidak berdebat. Urutkan untuk Bibi: tiga panen terberat musim Kemarau, dari yang paling berat. Biar papan pengumuman yang bicara."',
  objectiveText:
    'Dari tabel panen_logs, tampilkan petani, tanaman, dan berat_kg untuk TIGA panen terberat musim Kemarau — urut dari yang terberat.',
  unlockedCartridges: ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'LIMIT'],
  initialCode: `-- Catatan panen seluruh desa tersimpan di tabel panen_logs:
-- petani, tanaman, berat_kg, dan musim tanamnya.
-- Bibi Flora minta TIGA panen terberat musim Kemarau saja,
-- lengkap dengan nama petani dan tanamannya, dari yang terberat.

SELECT petani, tanaman, ___
FROM panen_logs
WHERE musim = '___'
ORDER BY berat_kg ___
LIMIT ___;
`,
  sqlSeedScript: `CREATE TABLE panen_logs (
  id INTEGER PRIMARY KEY,
  petani TEXT,
  tanaman TEXT,
  berat_kg INTEGER,
  musim TEXT
);

INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (1, 'Pak Rani', 'Padi', 62, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (2, 'Bibi Flora', 'Cabai', 18, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (3, 'Cici', 'Jagung', 84, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (4, 'Pak Dulah', 'Padi', 96, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (5, 'Bibi Flora', 'Tomat', 24, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (6, 'Pak Rani', 'Singkong', 77, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (7, 'Sari', 'Jagung', 77, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (8, 'Pak Dulah', 'Kedelai', 91, 'Kemarau');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (9, 'Pak Rani', 'Padi', 88, 'Hujan');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (10, 'Cici', 'Jagung', 88, 'Hujan');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (11, 'Bibi Flora', 'Melon', 45, 'Hujan');
INSERT INTO panen_logs (id, petani, tanaman, berat_kg, musim) VALUES (12, 'Sari', 'Padi', 70, 'Hujan');
`,
  expectedSqlResult: [
    { petani: 'Pak Dulah', tanaman: 'Padi', berat_kg: 96 },
    { petani: 'Pak Dulah', tanaman: 'Kedelai', berat_kg: 91 },
    { petani: 'Cici', tanaman: 'Jagung', berat_kg: 84 },
  ],
  // Quest ini mengajarkan urutan: verdict dibandingkan per posisi.
  sqlOrderMatters: true,
  // Scanner menampilkan tabel panen sebagai isi database desa (SQL-M2).
  sqlSourceTable: 'panen_logs',
  hints: [
    'Bibi Flora membalik halaman catatannya: "Semua panen ada di tabel panen_logs, Nak. Kita cuma mau musim Kemarau — saring dulu dengan WHERE musim = \'Kemarau\', seperti menyaring domba Pak Rani kemarin."',
    '"Nah, sekarang urutkan," kata Bibi Flora. "ORDER BY berat_kg DESC artinya susun dari yang terberat ke yang teringan — DESC itu menurun. Lalu LIMIT 3 memotongnya jadi tiga teratas saja. Tanpa urutan, tabel memberi baris sesuka hatinya."',
    'Rangkaian lengkapnya: SELECT petani, tanaman, berat_kg FROM panen_logs WHERE musim = \'Kemarau\' ORDER BY berat_kg DESC LIMIT 3; — Bibi Flora sudah menyiapkan spidol untuk papan pengumuman. Tiga nama, tiga tanaman, dari yang terberat.',
  ],
  onSuccessWorldEvents: ['HARVEST_RANKED', 'FIELDS_TIDIED'],
  onFailFunnyReactions: {
    too_many_rows:
      'Daftar yang kamu umumkan panjangnya seperti daftar belanja satu desa. Bibi Flora mengangkat kacamatanya: "Nak, Bibi cuma minta TIGA yang terberat. Sisanya biar di buku catatan saja — papan pengumumannya tidak muat, dan Pak RT sudah mulai menggerutu." Potong hasilnya dengan LIMIT 3.',
    no_rows:
      'Tidak ada satu baris pun yang cocok. Bibi Flora mengerutkan kening: "Masa panen Kemarau kosong? Ladang Bibi jelas-jelas panen kemarin." Periksa lagi nilai musim yang kamu cari — ejaannya harus persis \'Kemarau\', dengan huruf K besar.',
    wrong_column:
      'Kolomnya belum pas. Untuk papan pengumuman, Bibi Flora butuh tepat tiga hal: nama petani (petani), tanamannya (tanaman), dan beratnya (berat_kg). Tidak kurang, tidak lebih — kolom id dan musim tidak usah ikut naik panggung.',
    wrong_result:
      'Tiga baris memang tampil, tapi isinya atau urutannya belum yang terberat musim Kemarau. Ingat dua hal: saring dulu musimnya (panen Hujan yang berat tidak ikut lomba), lalu urutkan dari yang terberat dengan ORDER BY berat_kg DESC sebelum memotongnya jadi tiga.',
    syntax_error:
      'Cyber-Deck berbunyi "krtk... krtk..." lalu berhenti. Susunan perintahmu ada yang kurang pas — baca lagi dari SELECT-nya, periksa urutannya: pilih kolom, dari tabel, saring, urutkan, batasi.',
  },
};
