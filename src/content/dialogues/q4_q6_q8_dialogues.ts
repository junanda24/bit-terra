/**
 * Dialog untuk Q4 + Q6 + Q8 — Bit-Terra Fase 3 (Tahap C1).
 *
 * Format sama dengan q1_q2_dialogues.ts: kunci = quest id, lalu fase
 * percakapan ('phase2' khusus final HYBRID Q8: transisi antar fase).
 * Semua teks Bahasa Indonesia, tanpa emoji.
 *
 * Suara karakter (docs/BRIEF-STORY.md):
 * - Bibi Flora: botani desa — hangat, praktis, menilai segala sesuatu dari
 *   hasil kebun; kertas catatannya lebih rapi dari arsip siapa pun.
 * - Pak Tua Query: arsiparis & guru SQL — pelan, puitis soal data, benci
 *   pembukuan yang tidak bisa diaudit.
 * - Viktor Vance: utusan OmniCloud — sopan berlebihan, bahasa korporat
 *   yang licin; kekalahannya pun disampaikan seperti siaran pers.
 * - Piko: seperti biasa — pendek, antusias, bip sesekali.
 */
import type { QuestDialogueScript } from './q1_q2_dialogues';

export const Q4_Q6_Q8_DIALOGUES: Record<string, QuestDialogueScript> = {
  quest_04_urutan_panen: {
    intro: [
      {
        speaker: 'Bibi Flora',
        text: 'Nak, tolong Bibi sebelum debat petani di balai desa berubah jadi lomba teriak. Pak Dulah bilang padinya yang terberat musim Kemarau ini. Pak Rani bilang singkongnya. Cici? Cici cuma tertawa.',
      },
      {
        speaker: 'Bibi Flora',
        text: 'Semua panen tercatat di tabel panen_logs — petani, tanaman, berat, musim. Tapi urutannya masih acak sejak Rollback. Urutkan untuk Bibi: tiga terberat musim Kemarau, dari yang paling berat. Papan pengumuman butuh jawaban, bukan ingatan.',
      },
      {
        speaker: 'Piko',
        text: 'Perintah baru untukku: ORDER BY itu seperti menyusun hasil panen di meja dari yang paling berat. Dan LIMIT itu Bibi Flora bilang "cukup tiga, jangan serakah". Siap!',
      },
    ],
    hint1: [
      {
        speaker: 'Bibi Flora',
        text: 'Saring dulu musimnya, Nak: WHERE musim = \'Kemarau\'. Panen musim Hujan tidak ikut lomba ini, seberat apa pun dia.',
      },
    ],
    hint2: [
      {
        speaker: 'Bibi Flora',
        text: 'Urutkannya begini: ORDER BY berat_kg DESC — dari terberat menurun. Lalu LIMIT 3 memotongnya. Kalau DESC-nya lupa, yang tampil justru tiga yang paling ringan, dan Pak Dulah bisa pingsan.',
      },
    ],
    hint3: [
      {
        speaker: 'Piko',
        text: 'Aku bisikkan lengkapnya: SELECT petani, tanaman, berat_kg FROM panen_logs WHERE musim = \'Kemarau\' ORDER BY berat_kg DESC LIMIT 3; — jalankan, biar papan pengumuman yang mengakhiri debatnya.',
      },
    ],
    success: [
      {
        speaker: 'Bibi Flora',
        text: 'Pak Dulah, Pak Dulah, lalu Cici! Padi 96, kedelai 91, jagung 84. Dan lihat — Pak Dulah menempati dua dari tiga kursi. Mulai hari ini dia boleh sombong, tapi cuma sedikit.',
      },
      {
        speaker: 'Piko',
        text: 'Debat selesai tanpa satu pun suara ditinggikan. Begini rasanya data yang terurut: semua orang pulang, dan papan pengumumannya yang bicara.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Ups — daftarnya belum yang Bibi Flora maksud. Tidak apa-apa, meja urutnya masih di sini. Periksa dua hal: musimnya sudah Kemarau? Urutannya sudah dari yang terberat?',
      },
    ],
  },

  quest_06_kas_festival: {
    intro: [
      {
        speaker: 'Pak Tua Query',
        text: 'Duduk, Nak. Dua buku ini adalah seluruh masalah Festival Panen Raya: anggota_festival mencatat ORANGNYA, kas_festival mencatat UANGNYA — dan keduanya hanya terhubung oleh satu nomor kecil bernama anggota_id.',
      },
      {
        speaker: 'Pak Tua Query',
        text: 'Selama bertahun-tahun kas festival tidak cocok karena tidak ada yang menggabungkan dua buku ini dengan benar. Tahun ini kita mulai dari penyewa stan: siapa yang menyetor Sewa Stan di atas seratus lima puluh ribu? Gabungkan bukunya. JOIN namanya.',
      },
      {
        speaker: 'Piko',
        text: 'Dua buku, satu jawaban. Aku suka misi yang bukunya bisa ditutup rapat di akhir. Siap menggabungkan, Fixer!',
      },
    ],
    hint1: [
      {
        speaker: 'Pak Tua Query',
        text: 'Tulis FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id. Huruf a dan k adalah nama panggilan — arsiparis pun malas menulis nama tabel yang panjang berulang-ulang, Nak.',
      },
    ],
    hint2: [
      {
        speaker: 'Pak Tua Query',
        text: 'Dua saringan, jangan tertukar: kategorinya harus \'Sewa Stan\', dan jumlahnya DI ATAS 150.000 — tanda lebih dari (>), bukan sama dengan. Setoran yang persis di angka batas itu belum "di atas", Nak.',
      },
    ],
    hint3: [
      {
        speaker: 'Piko',
        text: 'Rangkaian lengkap dari bisikan Pak Tua: SELECT a.nama, k.jumlah FROM anggota_festival a JOIN kas_festival k ON k.anggota_id = a.id WHERE k.kategori = \'Sewa Stan\' AND k.jumlah > 150000; — kalau yang muncul tiga nama, bukunya klop.',
      },
    ],
    success: [
      {
        speaker: 'Pak Tua Query',
        text: 'Pak Rani, Bibi Flora, Sari. Tiga penyewa stan, tiga setoran, semua tercatat dengan nama yang jelas. Bertahun-tahun kas ini "selisih" hanya karena tidak ada yang mau menggabungkan dua buku sederhana.',
      },
      {
        speaker: 'Pak Tua Query',
        text: 'Festival tahun ini akan diaudit dengan cara yang benar — caramu. OmniCloud boleh menawarkan awan mereka, Nak. Desa ini akhirnya bisa membaca bukunya sendiri.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Bukunya belum klop — ada nama yang nyasar atau saringan yang bocor. Cek lagi dua hal: JOIN-nya sudah menautkan anggota_id ke id? Kategori dan batas jumlahnya sudah tepat?',
      },
    ],
  },

  quest_08_great_commit: {
    intro: [
      {
        speaker: 'Pak Tua Query',
        text: 'Surat "magang" dari OmniCloud itu sampai juga ke tanganmu, ya. Sopan sekali bahasanya. Perusahaan memang selalu sopan tepat sebelum mereka mengambil sesuatu.',
      },
      {
        speaker: 'Pak Tua Query',
        text: 'Lihat tabel omni_sync_logs ini, Nak — catatan sinkronisasi semua perangkat desa ke akar Pohon Induk. Empat barisnya bertanda CORRUPT. Bukan rusak sendiri; ada yang menyusupkannya, supaya desa terlihat tidak mampu mengurus datanya sendiri dan akhirnya menyerahkan akar ini ke awan mereka.',
      },
      {
        speaker: 'Piko',
        text: 'Bip. Aku sudah memindai akarnya. Datanya bisa diselamatkan — tapi hanya dari dalam, oleh tangan yang jujur. Dua fase, Fixer: perbaiki datanya, lalu aku yang mengantarkan sinkronisasinya ke terminal kristal.',
      },
    ],
    hint1: [
      {
        speaker: 'Pak Tua Query',
        text: 'Selidiki sebelum memperbaiki, itu aturan arsiparis: SELECT id, perangkat, status FROM omni_sync_logs WHERE status = \'CORRUPT\'. Biarkan baris yang rusak mengaku dulu.',
      },
    ],
    hint2: [
      {
        speaker: 'Pak Tua Query',
        text: 'UPDATE tanpa WHERE itu seperti menyiram seluruh kebun untuk satu petak yang kering, Nak. Sensor Kelembapan memang sedang PENDING, Konveyor memang sengaja OFFLINE — keduanya sehat. Hanya yang CORRUPT yang sakit.',
      },
    ],
    hint3: [
      {
        speaker: 'Piko',
        text: 'Satu kalimat untuk fase satu: UPDATE omni_sync_logs SET status = \'SYNCED\' WHERE status = \'CORRUPT\'; — sesudah datanya bersih, giliranku: boot, moveForward(4), charge di terminal kristal. Kita selesaikan Rollback ini bersama.',
      },
    ],
    phase2: [
      {
        speaker: 'Piko',
        text: 'BIP! Datanya bersih — empat baris yang dirusak sudah pulih, dan tidak satu pun baris sehat ikut berubah. Kerja arsiparis yang rapi, Fixer.',
      },
      {
        speaker: 'Pak Tua Query',
        text: 'Sekarang fase terakhir, Nak. Antarkan Piko menyusuri akar ke terminal kristal dan salurkan sinkronisasinya. Sepuluh tahun Pohon Induk menunggu kalimat penutup ini.',
      },
    ],
    success: [
      {
        speaker: 'Piko',
        text: 'BIP BIP BIP! Akar-akarnya menyala, Fixer — aku bisa merasakannya sampai ke antena! Semua catatan desa mengalir pulang ke Pohon Induk, utuh, seperti sebelum Rollback. THE GREAT ROLLBACK... DIBATALKAN!',
      },
      {
        speaker: 'Viktor Vance',
        text: '...Tim kami sudah menerima memo penarikan tawaran migrasi. Desa ini, rupanya, mampu mengurus datanya sendiri. Selamat. OmniCloud menghargai... mitra yang kompeten.',
      },
      {
        speaker: 'Pak Tua Query',
        text: 'Dengar itu, Nak? Itu bunyi awan yang pergi. Dan ini — ia menepuk akar Pohon Induk yang mulai berbunga — ini bunyi desa yang tinggal. Terima kasih sudah pulang.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Belum selesai, Fixer — akarnya masih berdenyut tidak sabar. Tidak apa-apa. Rollback sebesar ini tidak menuntut kita sempurna, cuma menuntut kita tidak menyerah. Coba lagi, pelan-pelan.',
      },
    ],
  },
};
