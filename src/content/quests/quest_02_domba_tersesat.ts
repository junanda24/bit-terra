import type { QuestDefinition } from '../../shared/types';

/**
 * Q2 — "Domba yang Tersesat" (SQL, EASY, Act 1)
 *
 * Misi SQL pertama pemain: menyaring catatan kalung sensor domba milik
 * Pak Rani, peternak desa, untuk menemukan 3 domba yang kabur saat badai.
 *
 * Pemberi misi: Pak Rani (giverNpcId 'pak_rtani') — peternak Bit-Terra,
 * hafal nama semua dombanya tapi pusing membaca tabel. Pak Tua Query,
 * arsiparis desa, sesekali menimpali di hint.
 *
 * Konsistensi data (WAJIB dijaga kalau seed diubah):
 * - Seed berisi 12 baris; tepat 3 berstatus 'LOST':
 *   Kriting (Tepi Sungai), Bolang (Dekat Bendungan), Brintik (Kebun Bibi Flora).
 * - `expectedSqlResult` di bawah HARUS sama persis dengan hasil query
 *   SELECT sheep_name, last_zone FROM livestock_logs WHERE status = 'LOST'
 *   terhadap seed ini — nama, zona, dan ejaan. Integrasi Fase 1 akan
 *   membuktikannya dengan benar-benar menjalankan seed di sql.js
 *   (lihat catatan di src/content/quests/index.ts).
 */
export const quest02DombaTersesat: QuestDefinition = {
  id: 'quest_02_domba_tersesat',
  title: 'Domba yang Tersesat',
  act: 1,
  difficulty: 'EASY',
  mode: 'SQL',
  giverNpcId: 'pak_rtani',
  storyContext:
    'Badai semalam merobohkan satu sisi pagar kandang Pak Rani, dan tiga dombanya menyelinap keluar sebelum subuh. Untungnya kalung sensor setiap domba masih mencatat posisi terakhir mereka ke tabel livestock_logs milik desa. Masalahnya cuma satu: Pak Rani jauh lebih hafal nama dombanya satu per satu daripada cara membaca tabel. "Nak, tolong saringkan catatan ini," katanya sambil menyodorkan daftar nama yang ditulis tangan. "Kepalaku langsung pusing tiap melihat huruf-huruf kecil itu."',
  objectiveText:
    'Saring tabel livestock_logs: tampilkan sheep_name dan last_zone hanya untuk domba yang statusnya LOST.',
  unlockedCartridges: ['SELECT', 'FROM', 'WHERE'],
  initialCode: `-- Catatan kalung domba tersimpan di tabel livestock_logs.
-- Kita hanya butuh dua hal: nama domba (sheep_name) dan zona
-- terakhirnya terlihat (last_zone) — khusus yang statusnya 'LOST'.

SELECT sheep_name, ___
FROM livestock_logs
WHERE status = '___';
`,
  sqlSeedScript: `CREATE TABLE livestock_logs (
  id INTEGER PRIMARY KEY,
  sheep_name TEXT,
  last_zone TEXT,
  status TEXT
);

INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (1, 'Si Putih', 'Kandang', 'HOME');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (2, 'Gembul', 'Kandang', 'HOME');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (3, 'Kriting', 'Tepi Sungai', 'LOST');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (4, 'Moci', 'Kebun Bibi Flora', 'SAFE');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (5, 'Bolang', 'Dekat Bendungan', 'LOST');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (6, 'Si Cemong', 'Pasar', 'SAFE');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (7, 'Klinting', 'Kandang', 'HOME');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (8, 'Brintik', 'Kebun Bibi Flora', 'LOST');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (9, 'Pudel', 'Tepi Sungai', 'SAFE');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (10, 'Gondrong', 'Dekat Bendungan', 'SAFE');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (11, 'Meri', 'Pasar', 'HOME');
INSERT INTO livestock_logs (id, sheep_name, last_zone, status) VALUES (12, 'Kucir', 'Kandang', 'SAFE');
`,
  expectedSqlResult: [
    { sheep_name: 'Kriting', last_zone: 'Tepi Sungai' },
    { sheep_name: 'Bolang', last_zone: 'Dekat Bendungan' },
    { sheep_name: 'Brintik', last_zone: 'Kebun Bibi Flora' },
  ],
  // Scanner menampilkan tabel ini sebagai isi database desa (SQL-M2) —
  // bukan sekadar tabel pertama menurut abjad.
  sqlSourceTable: 'livestock_logs',
  hints: [
    'Pak Rani menunjuk layar Cyber-Deck dengan ujung tongkatnya: "Semua catatan kalung domba ada di tabel livestock_logs. Mulailah dengan SELECT untuk memilih data yang mau dilihat, lalu FROM untuk menyebut nama tabelnya."',
    'Pak Tua Query yang kebetulan lewat ikut menimpali sambil mengelus janggut: "Kita hanya mencari yang hilang, Nak. Saring barisnya dengan WHERE status = \'LOST\' — dan ingat, kata LOST ditulis di dalam tanda kutip."',
    'Rangkaian lengkapnya begini: SELECT sheep_name, last_zone FROM livestock_logs WHERE status = \'LOST\'; — dua kolom saja, satu saringan saja. Coba jalankan, biar Piko yang membacakan hasilnya untuk Pak Rani.',
  ],
  onSuccessWorldEvents: ['SHEEP_SPOTTED', 'SHEEP_RETURN'],
  onFailFunnyReactions: {
    too_many_rows:
      'Tanpa saringan yang pas, pengumumanmu terbaca sebagai undangan terbuka untuk SEMUA hewan desa. Menjelang siang, seluruh ayam, dua kambing, dan seekor kucing oren sudah berbaris rapi di depan balai desa, menunggu namanya dipanggil.',
    no_rows:
      'Hasilnya kosong melompong. Pak Rani menggaruk kepalanya: "Lho, masa iya domba-dombaku berubah jadi data hantu?" Coba periksa lagi nilai status yang kamu cari — ejaannya harus persis sama dengan yang ada di tabel.',
    wrong_column:
      'Jumlah kolomnya belum pas. Pak Rani cuma butuh dua hal dari catatan itu: nama domba (sheep_name) dan zona terakhirnya (last_zone) — tidak kurang, tidak lebih. Piko menghitungnya sekali lagi pakai jari-jari robotnya yang mungil, lalu menunjuk daftar SELECT-mu: "Coba samakan dengan dua itu, ya."',
    wrong_result:
      'Barisnya pas tiga, tapi isinya bukan tiga domba yang hilang. Pak Rani membaca daftar itu dua kali, keningnya berkerut: "Lho, bukan yang ini yang kabur semalam, Nak." Saringannya sudah dekat — pastikan yang tampil hanya domba yang statusnya LOST.',
    syntax_error:
      'Cyber-Deck mengeluarkan bunyi "krtk... krtk..." lalu berhenti, seperti tersedak sebaris tulisan. Ada yang kurang pas di susunan kalimat perintahmu — coba baca lagi dari kata SELECT-nya.',
  },
};
