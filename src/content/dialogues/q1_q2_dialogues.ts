/**
 * Dialog untuk Q1 + Q2 — Bit-Terra Fase 1.
 *
 * Format: kunci = quest id, lalu fase percakapan. Setiap fase adalah array
 * baris { speaker, text } yang ditampilkan berurutan oleh DialogueBox.
 * Semua teks Bahasa Indonesia, tanpa emoji (aturan rumah: label & teks UI
 * bersih dari emoji; kehangatan datang dari kata-katanya, bukan hiasan).
 *
 * Suara karakter (sesuai docs/BRIEF-STORY.md):
 * - Piko: robot kecil ceria seperti anak yang baru bangun tidur — kalimat
 *   pendek, antusias, sesekali menyebut bunyi bip-nya sendiri.
 * - Pak Tua Query: arsiparis & guru SQL — bicara pelan, suka menyelipkan
 *   istilah data ke percakapan sehari-hari.
 * - Pak Rani: peternak — hangat, sedikit panik soal dombanya, nol urusan
 *   dengan tabel sebelum misi ini.
 * - Catatan Kakek: suara Kakek lewat tulisan tangan yang ditinggalkan di
 *   bengkel (Q1 tidak punya pemberi misi yang hidup; catatannya yang bicara).
 */

export interface DialogueLine {
  speaker: string;
  text: string;
}

export type DialoguePhase =
  | 'intro'
  | 'hint1'
  | 'hint2'
  | 'hint3'
  | 'success'
  | 'funnyFail';

export type QuestDialogueScript = Partial<Record<DialoguePhase, DialogueLine[]>>;

export const Q1_Q2_DIALOGUES: Record<string, QuestDialogueScript> = {
  quest_01_bangun_piko: {
    intro: [
      {
        speaker: 'Catatan Kakek',
        text: 'Untuk cucuku, kalau kau membaca ini, berarti kau benar-benar pulang. Bengkel ini sekarang milikmu. Jaga baik-baik, ya.',
      },
      {
        speaker: 'Catatan Kakek',
        text: 'Di pojok ruangan ada Piko, robot kecil yang menemaniku bertahun-tahun. Ia tertidur sejak aku pergi, baterainya habis. Tolong bangunkan dia. Dia benci gelap, sama seperti kakeknya.',
      },
      {
        speaker: 'Piko',
        text: '...bip... bip... (layar CRT di wajahnya berkedip sangat lemah, seperti orang bermimpi tentang matahari)',
      },
    ],
    hint1: [
      {
        speaker: 'Catatan Kakek',
        text: 'Di bawah catatan ini Kakek tempel pengingat: Piko tidak bisa bergerak sebelum sistemnya dinyalakan. Selalu mulai dengan boot(). Urutan itu penting, Nak.',
      },
    ],
    hint2: [
      {
        speaker: 'Piko',
        text: '(suara siaga, lirih) Peta bengkel masih kusimpan... Aku di petak (0, 2). Petak cahayanya di (3, 2). Tiga petak lurus. Tinggal disuruh jalan saja...',
      },
    ],
    hint3: [
      {
        speaker: 'Catatan Kakek',
        text: 'Kalau kau buntu, ini urutan persisnya: piko.boot(), lalu piko.moveForward(3), terakhir piko.charge(). Tiga baris. Setelah itu tarik tuas RUN dan lihat dia melangkah satu-satu.',
      },
    ],
    success: [
      {
        speaker: 'Piko',
        text: 'BIP BIP! Aku hidup! Kepalaku ringan, kakiku hangat... ini pasti sinar matahari. Dan kamu — kamu pasti cucu Kakek!',
      },
      {
        speaker: 'Piko',
        text: 'Namaku Piko. Mulai hari ini aku menemanimu memperbaiki Bit-Terra. Beri aku perintah satu per satu, dan aku janji tidak akan menabrak pagar. Yah... tidak sering-sering.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Aduh... bintang-bintang kecil ini berputar karena aku, atau dunia memang begini? Tidak apa-apa, susun lagi perintahnya. Pelan-pelan saja, aku tidak ke mana-mana.',
      },
    ],
  },

  quest_02_domba_tersesat: {
    intro: [
      {
        speaker: 'Pak Rani',
        text: 'Nak, tolong! Badai semalam merobohkan pagar kandangku. Tiga dombaku kabur sebelum subuh, entah ke mana.',
      },
      {
        speaker: 'Pak Rani',
        text: 'Untung kalung mereka masih mengirim catatan posisi ke tabel desa. Tapi kepalaku langsung pusing tiap melihat tabel-tabel itu. Aku ini peternak, bukan pembaca data.',
      },
      {
        speaker: 'Piko',
        text: 'Serahkan ke kami, Pak Rani! Cyber-Deck menyaring catatannya, Pak Rani menyiapkan kandangnya. Kesepakatan yang adil.',
      },
    ],
    hint1: [
      {
        speaker: 'Pak Rani',
        text: 'Kata Pak Tua Query, semua catatan kalung ada di tabel livestock_logs. Mulai dengan SELECT untuk memilih datanya, lalu FROM untuk menyebut tabelnya. Begitu katanya — aku cuma mengulang.',
      },
    ],
    hint2: [
      {
        speaker: 'Pak Tua Query',
        text: 'Kita hanya mencari yang hilang, Nak. Saring barisnya: WHERE status = \'LOST\'. Ingat, kata LOST memakai tanda kutip — di dunia data, kata tanpa kutip itu bukan kata, tapi nama kolom.',
      },
    ],
    hint3: [
      {
        speaker: 'Piko',
        text: 'Aku bisikkan rangkaian lengkapnya: SELECT sheep_name, last_zone FROM livestock_logs WHERE status = \'LOST\'; — dua kolom, satu saringan. Jalankan, nanti kubacakan hasilnya keras-keras untuk Pak Rani.',
      },
    ],
    success: [
      {
        speaker: 'Pak Rani',
        text: 'Itu dia! Kriting di tepi sungai, Bolang dekat bendungan, dan Brintik... sudah kuduga, pasti sedang mengunyah bunga Bibi Flora. Terima kasih, Nak!',
      },
      {
        speaker: 'Piko',
        text: 'Tiga domba, tiga lokasi, nol drama. Begini caranya sebaris saringan menyelamatkan satu pagi di Bit-Terra.',
      },
    ],
    funnyFail: [
      {
        speaker: 'Piko',
        text: 'Ups. Sepertinya pengumumannya kesasar ke semua hewan desa. Lihat, ayam-ayam itu sudah berbaris rapi di depan balai. Lucu sih — tapi bukan itu yang kita cari. Coba lagi, ya.',
      },
    ],
  },
};

/** Ambil naskah dialog satu quest (undefined bila quest belum punya dialog). */
export function getQuestDialogue(
  questId: string,
): QuestDialogueScript | undefined {
  return Q1_Q2_DIALOGUES[questId];
}
