import type { QuestDialogueScript } from './q1_q2_dialogues';

/**
 * Dialog untuk Q3 + Q5 + Q7 — Bit-Terra Fase 3 (sisi bot).
 *
 * Format sama dengan q1_q2_dialogues.ts: kunci = quest id, lalu fase
 * percakapan. Semua teks Bahasa Indonesia, tanpa emoji.
 *
 * Suara karakter (docs/BRIEF-STORY.md):
 * - Cici Loops: mekanik desa, guru logika & loop — praktis, hangat,
 *   suka menjelaskan mesin seperti menjelaskan resep dapur.
 * - Bibi Flora: ahli botani, guru array & grid — lembut, sabar,
 *   bicara tentang tanaman seperti bicara tentang anak-anak.
 * - Piko: robot kecil ceria — kalimat pendek, antusias, bip sesekali.
 */
export const Q3_Q5_Q7_DIALOGUES: Record<string, QuestDialogueScript> = {
  quest_03_pintu_air: {
    intro: [
      {
        speaker: 'Cici Loops',
        text: 'Nah, ini dia pintu air yang kubilang. Macet sejak Rollback — terbuka terus sampai air bendungan habis, atau tertutup terus sampai ladang retak. Pintu kok tidak punya pendirian.',
      },
      {
        speaker: 'Cici Loops',
        text: 'Padahal resepnya sederhana, Nak: kalau tanah kering, buka. Kalau tanah basah, tutup. Satu sensor, dua pilihan. Dalam bahasa Piko: if dan else. Tuliskan aturannya, dan biar dia yang jaga malam mulai sekarang.',
      },
      {
        speaker: 'Piko',
        text: 'Bip! Aku siap jaga malam, Cici! Aku akan membaca sensornya baik-baik... asal ada yang menuliskan harus bagaimana. Itu bagianmu, Fixer.',
      },
    ],
    hint1: [
      {
        speaker: 'Cici Loops',
        text: 'Satu keputusan, dua arah. Baca sensornya, bandingkan dengan batas kering, lalu pilih: buka atau tutup. Pintu tidak butuh perintah banyak — dia butuh keputusan yang benar.',
      },
    ],
    hint2: [
      {
        speaker: 'Piko',
        text: 'Bacaan sensorku 0 sampai 100, Fixer. Makin kecil, makin kering. Batas keringnya 40. Kalau bacaanku di bawah 40... berarti tanahnya haus, kan?',
      },
    ],
    hint3: [
      {
        speaker: 'Cici Loops',
        text: 'Cabang if untuk yang kering: gate.open(). Cabang else untuk sisanya — yang basah: gate.close(). Sudah. Jangan ditukar, nanti kamu yang kujitak pakai kunci inggris.',
      },
    ],
    success: [
      {
        speaker: 'Piko',
        text: 'Uji kering: pintu membuka, air mengalir! Uji basah: pintu menutup rapat! Dua-duanya benar, Fixer — aku resmi jadi penjaga pintu air sekarang!',
      },
      {
        speaker: 'Cici Loops',
        text: 'Dengar itu? Air mengalir ke ladang dengan tertib, bukan tumpah, bukan mampet. Begitulah if dan else bekerja kalau ditulis dengan jujur. Kerja bagus, Nak.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Bip... aturannya masih meleset di satu cuaca. Tidak apa-apa — pintu air memang guru yang galak. Kita baca lagi dua cabangnya, pelan-pelan.',
      },
    ],
  },

  quest_05_konveyor_roti: {
    intro: [
      {
        speaker: 'Cici Loops',
        text: 'Selamat datang di gudang rotiku. Lihat tiga peti itu? Roti festival, semuanya. Rak pemuatannya yang berbintang di sebelah timur sana — dan punggungku sudah mengajukan surat pengunduran diri.',
      },
      {
        speaker: 'Cici Loops',
        text: 'Kabar baiknya: jarak tiap peti ke raknya sama persis. Empat dorongan. Pola yang sama tiga kali — dan pekerjaan yang berulang dengan pola sama itu jangan dikerjakan dengan tangan, Nak. Itu pekerjaan loop.',
      },
      {
        speaker: 'Piko',
        text: 'Aku kuat, aku tidak protes, aku... baru sadar aku tidak tahu jalan di gudang ini. Kamu otaknya, Fixer. Aku ototnya. Kesepakatan yang adil!',
      },
    ],
    hint1: [
      {
        speaker: 'Cici Loops',
        text: 'Tulis polanya sekali sebagai function: dorong empat kali. Lalu panggil fungsinya tiga kali, sekali per peti. Yang berubah antarpeti cuma posisi mulai Piko — polanya tidak.',
      },
    ],
    hint2: [
      {
        speaker: 'Piko',
        text: 'Koridor barat gudang selalu kosong, Fixer — kolom paling kiri. Dari sana aku bisa pindah jalur dan selalu datang ke peti dari belakangnya. Peti cuma mau didorong dari belakang, katanya.',
      },
    ],
    hint3: [
      {
        speaker: 'Cici Loops',
        text: 'Blanko di loop itu angka 4 — empat dorongan per peti. Berdiri di (2, y), panggil fungsinya, peti meluncur ke bintang di (7, y). Tiga jalur: y=1, y=2, y=3. Sisanya tinggal navigasi.',
      },
    ],
    success: [
      {
        speaker: 'Piko',
        text: 'Tiga peti, tiga bintang, semua pas! Barusan aku menghitung: dua belas dorongan, nol keluhan. Rekor gudang!',
      },
      {
        speaker: 'Cici Loops',
        text: 'Dan kamu cuma menulis polanya satu kali. Itulah bedanya bekerja keras dan bekerja pintar, Nak. Roti festival aman. Besok pagi, desa sarapan enak.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Bip. Ada peti yang belum sampai, atau aku yang tersesat di antara rak. Gudang ini lebih rumit dari kelihatannya. Coba lagi, Fixer — petinya tidak ke mana-mana.',
      },
    ],
  },

  quest_07_jembatan_kristal: {
    intro: [
      {
        speaker: 'Bibi Flora',
        text: 'Pegang oborku, Nak, dan melangkahlah pelan-pelan. Ini labirin akar Pohon Induk. Dua belas tunas kristal tumbuh di koridornya — semuanya layu, semuanya menunggu disiram.',
      },
      {
        speaker: 'Bibi Flora',
        text: 'Perhatikan susunannya baik-baik: koridornya melingkar empat sisi, dan di setiap sisi ada tiga tunas, selalu di tiga petak pertama sesudah sudut. Pola yang sama, di dalam pola yang lebih besar. Seperti kebun — dan seperti kode yang baik.',
      },
      {
        speaker: 'Piko',
        text: 'Aku bawa ember virtualku, Bibi! Dua belas tunas... kedengarannya banyak, tapi kalau polanya berulang, aku cuma perlu belajar satu sisi. Betul begitu, kan, Fixer?',
      },
    ],
    hint1: [
      {
        speaker: 'Bibi Flora',
        text: 'Jangan hafalkan dua belas posisi, Nak. Hafalkan satu sisi: tiga tunas, tiga petak pertama. Lalu sadari bahwa labirinnya mengulang sisi itu empat kali. Loop di dalam loop.',
      },
    ],
    hint2: [
      {
        speaker: 'Piko',
        text: 'Dari sudut: petak ke-1 tunas, ke-2 tunas, ke-3 tunas, ke-4 kosong, ke-5 sudut lagi. Jadi per sisi: siram sambil jalan tiga langkah, lalu jalan dua langkah, lalu belok. Aku mulai melihat polanya, Bibi!',
      },
    ],
    hint3: [
      {
        speaker: 'Bibi Flora',
        text: 'Tulis persis begini di kepalamu: loop luar berjalan 4 kali; di dalamnya panggil fungsi sisimu, lalu turnRight(). Fungsi sisimu: loop 3 kali berisi moveForward(1) dan water(), ditutup moveForward(2). Itu saja. Selebihnya serahkan pada pengulangan.',
      },
    ],
    success: [
      {
        speaker: 'Piko',
        text: 'Tunas terakhir tersiram — Bibi, lihat! Akar-akar tuanya bergerak! Lorongnya membuka seperti tirai raksasa yang disingkap pelan-pelan!',
      },
      {
        speaker: 'Bibi Flora',
        text: 'Pohon Induk membalas yang merawat anaknya, Nak. Jalan ke Jembatan Kristal terbuka lagi setelah sepuluh tahun. Dan kamu sampai ke sana bukan dengan menghafal — tapi dengan melihat pola. Itulah bedanya tukang kebun dan tamu kebun.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Bip... ada tunas yang masih haus, atau aku berputar di sisi yang sama dua kali. Labirin ini memang dibuat membingungkan. Tarik napas, Fixer — polanya tetap di sana, menunggu ditemukan.',
      },
    ],
  },
};
