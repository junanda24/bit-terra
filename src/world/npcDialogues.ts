/**
 * Dialog dunia Bit-Terra (Fase 2): percakapan NPC, papan petunjuk, dan
 * jangkar rasa quest Fase 3. Semua teks Bahasa Indonesia, hangat, tanpa
 * emoji — kehangatan dari kata-kata, bukan hiasan (gaya content Fase 1).
 *
 * Dialog dipilih menurut progres: beberapa penutur berubah ucapannya
 * setelah quest terkait selesai. Fungsi murni, diuji di world.test.ts.
 */
import { QUEST_01_ID, QUEST_02_ID } from './worldState';

export interface WorldDialogue {
  name: string;
  lines: string[];
}

/** Dialog saat pemain berinteraksi; `completed` = daftar quest selesai. */
export function getWorldDialogue(
  dialogueId: string,
  completedQuests: readonly string[],
): WorldDialogue | null {
  const done = new Set(completedQuests);
  const q1 = done.has(QUEST_01_ID);
  const q2 = done.has(QUEST_02_ID);

  switch (dialogueId) {
    case 'piko_awake':
      return {
        name: 'Piko',
        lines: [
          'Bip! Aku sudah bangun dan bateraiku penuh. Pojok gelap itu? Tidak, terima kasih — sekarang aku ikut ke mana pun kamu pergi.',
        ],
      };
    case 'workbench':
      return {
        name: 'Meja Kerja Kakek',
        lines: [
          'Meja kerja tua, penuh goresan dan lingkaran gelas kopi. Di laci atas ada catatan Kakek: "Alat boleh berkarat, Nak. Yang tidak boleh berkarat itu rasa penasaran."',
          q1
            ? 'Di samping meja, stiker pertama menempel di Cyber-Deck: Piko sudah bangun. Bengkel ini hidup lagi.'
            : 'Cyber-Deck Kakek tergeletak di meja, layarnya gelap. Ia menunggu seseorang membangunkannya — sama seperti Piko.',
        ],
      };
    case 'rani_thanks':
      return {
        name: 'Pak Rani',
        lines: [
          'Lihat mereka, bertiga sudah di kandang, kenyang dan sok innocent. Padahal semalam bikin satu desa begadang. Terima kasih, Nak.',
        ],
      };
    case 'pen_gate':
      return {
        name: 'Pintu Kandang',
        lines: q2
          ? [
              'Gerbang kandang tertutup rapat, engselnya baru diminyaki Pak Rani. Dari dalam terdengar kunyahan rumput yang sangat damai.',
            ]
          : [
              'Gerbang kandang miring, satu engselnya lepas diterjang badai semalam. Pantas saja ada yang bisa menyelinap keluar sebelum subuh.',
            ],
      };
    case 'cici':
      return {
        name: 'Cici Loops',
        lines: q1
          ? [
              'Eh, Piko sudah jalan-jalan! Kerja bagus. Dengarkan aku: pintu air di selatan itu macet sejak Rollback — kalau kemarau datang, ladang kita yang kena. Nanti bantu aku mikir, ya. Aku punya firasat pintunya cuma butuh logika "kalau kering, buka; kalau basah, tutup".',
              'Dan gudang konveyor rotiku di selatan plaza? Sabuknya berhenti total. Nanti-nanti saja. Satu-satu dulu, kayak baris kode.',
            ]
          : [
              'Kamu cucu Kakek, kan? Aku Cici, mekanik desa. Bengkel itu gelap sekali akhir-akhir ini… Kakek dulu bilang, semua perbaikan besar selalu mulai dari satu robot kecil yang dibangunkan.',
            ],
      };
    case 'flora':
      return {
        name: 'Bibi Flora',
        lines: q2
          ? [
              'Brintik akhirnya pulang juga dari kebunku. Tiga baris bungaku habis dikunyah, tapi lihat wajahnya — siapa yang tega marah? Kebun bisa ditanam lagi, Nak.',
              'Omong-omong, catatan panen desa masih acak-acakan sejak Rollback. Nanti kalau sempat, Bibi ajari kamu cara mengurutkan hasil panen dari yang terbaik. Ada tabelnya, tentu saja.',
            ]
          : [
              'Selamat datang di kebun Bibi Flora, Nak. Hati-hati menginjak petak bunga, ya. Dan kalau kamu lihat domba berbulu keriting mengunyah bungaku… itu Brintik. Dia langganan.',
            ],
      };
    case 'query':
      return {
        name: 'Pak Tua Query',
        lines: q1 && q2
          ? [
              'Dua catatan desa sudah lurus kembali. Pohon Induk mengingat lebih banyak setiap kali kita memperbaiki sesuatu dengan tangan sendiri, Nak. OmniCloud boleh menawarkan awan — kita punya akar.',
            ]
          : [
              'Ah, cucu Kakek sudah pulang. Aku Pak Tua Query, penjaga arsip desa. Dulu semua catatan Bit-Terra rapi di akar Pohon Induk — sampai The Great Rollback mengacaknya sepuluh tahun lalu.',
              'Ingat ini, Nak: data yang baik itu seperti kebun. Dipilih yang perlu (SELECT), diambil dari tempatnya (FROM), disaring yang relevan (WHERE). Sisanya… kompos.',
            ],
      };
    case 'mother_tree':
      return {
        name: 'Papan Pohon Induk',
        lines: [
          'Papan kayu tua bertuliskan tangan Kakek: "POHON INDUK BIT-TERRA — memori desa tinggal di akarnya. Siapa pun yang memperbaikinya dengan jujur, boleh membacanya."',
          'Di bawahnya ada ukiran kecil: "Cloud datang dan pergi. Akar tinggal."',
        ],
      };
    case 'great_commit':
      return {
        name: 'Akar Pohon Induk',
        lines: [
          'Akar raksasa itu berdenyut pelan, hangat seperti dada yang bernapas. Di celahnya, kristal memori berkedip tidak beraturan — sebagian catatan desa masih terkunci di sini.',
          'Piko berbisik dari Cyber-Deck: "Suatu hari nanti, kita perbaiki yang ini juga. Yang terakhir. Yang paling besar."',
        ],
      };
    case 'sluice':
      return {
        name: 'Pintu Air',
        lines: [
          'Pintu air bendungan kecil desa, macet setengah terbuka sejak The Great Rollback. Tuasnya berat, engselnya berderit protes.',
          'Cici pernah bilang: pintu ini seharusnya pintar — membuka saat tanah kering, menutup saat basah. "Cuma butuh if dan else," katanya. "Dan seseorang yang berani menarik tuasnya."',
        ],
      };
    case 'farm':
      return {
        name: 'Ladang Desa',
        lines: [
          'Baris-baris tanaman tumbuh rajin: ada yang siap panen, ada yang baru bertunas. Orang-orangan sawah tua mengawasi sambil tersenyum miring.',
          'Hasil panen desa dicatat di tabel, tapi urutannya masih acak sejak Rollback. "Panen terbaik" versi siapa — belum ada yang tahu. Nanti Bibi Flora pasti minta tolong soal ini.',
        ],
      };
    case 'conveyor':
      return {
        name: 'Gudang Konveyor Roti',
        lines: [
          'Dari celah pintu terdengar dengung mesin yang tertidur. Sabuk konveyor roti Cici berhenti di tengah jalan — roti terakhirnya masih di atas sabuk, sudah keras seperti batu bata kecil.',
          '"Sabuk itu harusnya mengulang gerakannya sendiri," kata Cici waktu itu. "Loop namanya. Nanti kubangunkan."',
        ],
      };
    case 'festival':
      return {
        name: 'Plaza Festival',
        lines: [
          'Plaza batu tempat Festival Panen Raya dirayakan tiap akhir tahun. Kios-kiosnya masih tertutup kain, menunggu hari besar.',
          'Kata Pak Tua Query, kas festival tahun lalu belum pernah cocok jumlahnya — ada selisih yang bersembunyi di antara dua tabel. Tahun ini, katanya sambil mengerling, "kita hitung pakai cara yang benar."',
        ],
      };
    case 'root_maze':
      return {
        name: 'Gerbang Akar',
        lines: [
          'Dua akar raksasa melengkung membentuk gerbang. Di baliknya, lorong gelap berliku menuju Jembatan Kristal — jalan pintas lama ke tambang yang putus sejak Rollback.',
          'Papan kecil di tiangnya berbunyi: "Belum aman. Pulang dulu, perbaiki desa. — K." Kakek selalu singkat kalau sedang khawatir.',
        ],
      };
    default:
      return null;
  }
}
