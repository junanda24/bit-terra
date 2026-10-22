/**
 * Dialog dunia Bit-Terra (Fase 2): percakapan NPC, papan petunjuk, dan
 * jangkar rasa quest Fase 3. Semua teks Bahasa Indonesia, hangat, tanpa
 * emoji — kehangatan dari kata-kata, bukan hiasan (gaya content Fase 1).
 *
 * Dialog dipilih menurut progres: beberapa penutur berubah ucapannya
 * setelah quest terkait selesai. Fungsi murni, diuji di world.test.ts.
 */
import {
  QUEST_01_ID,
  QUEST_02_ID,
  QUEST_03_ID,
  QUEST_04_ID,
  QUEST_05_ID,
  QUEST_06_ID,
  QUEST_07_ID,
  QUEST_08_ID,
} from './worldState';

export interface WorldDialogue {
  name: string;
  lines: string[];
}

/**
 * Dialog Kabut Otak untuk jangkar quest yang masih terkunci progresi
 * (Fase 3): desa menolak dengan lembut dan menyebut persis quest yang
 * harus diselesaikan lebih dulu — bukan tembok diam.
 */
export function getBrainFogDialogue(blockerTitle: string): WorldDialogue {
  return {
    name: 'Kabut Otak',
    lines: [
      'Kabut tipis turun di depanmu, berbau seperti halaman buku yang sudah lama tidak dibuka. Piko berhenti dan menggeleng: "Bip… belum bisa ke sini. Masih ada yang harus dibereskan lebih dulu."',
      `Selesaikan dulu: ${blockerTitle}. Sesudah itu kabut ini biasanya menyingkir sendiri.`,
    ],
  };
}

/** Dialog saat pemain berinteraksi; `completed` = daftar quest selesai. */
export function getWorldDialogue(
  dialogueId: string,
  completedQuests: readonly string[],
): WorldDialogue | null {
  const done = new Set(completedQuests);
  const q1 = done.has(QUEST_01_ID);
  const q2 = done.has(QUEST_02_ID);
  const q3 = done.has(QUEST_03_ID);
  const q4 = done.has(QUEST_04_ID);
  const q5 = done.has(QUEST_05_ID);
  const q6 = done.has(QUEST_06_ID);
  const q7 = done.has(QUEST_07_ID);
  const q8 = done.has(QUEST_08_ID);

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
    case 'flora': {
      const lines = q2
        ? [
            'Brintik akhirnya pulang juga dari kebunku. Tiga baris bungaku habis dikunyah, tapi lihat wajahnya — siapa yang tega marah? Kebun bisa ditanam lagi, Nak.',
            'Omong-omong, catatan panen desa masih acak-acakan sejak Rollback. Nanti kalau sempat, Bibi ajari kamu cara mengurutkan hasil panen dari yang terbaik. Ada tabelnya, tentu saja.',
          ]
        : [
            'Selamat datang di kebun Bibi Flora, Nak. Hati-hati menginjak petak bunga, ya. Dan kalau kamu lihat domba berbulu keriting mengunyah bungaku… itu Brintik. Dia langganan.',
          ];
      if (!q4) {
        lines.push(
          'Soal catatan panen itu, Nak — papan catatannya ada di ladang tenggara, dekat orang-orangan sawah. Bibi ingin tahu tiga panen terberat musim Kemarau. Tolong urutkan untuk Bibi, ya.',
        );
      } else {
        lines.push(
          'Urutan panen terbaik sudah terpampang di papan pengumuman. Para petani sampai bertaruh teh jahe menebak juara satunya — dan Pak Dulah tersenyum-senyum saja sejak itu.',
        );
      }
      return { name: 'Bibi Flora', lines };
    }
    case 'query': {
      const lines =
        q1 && q2
          ? [
              'Dua catatan desa sudah lurus kembali. Pohon Induk mengingat lebih banyak setiap kali kita memperbaiki sesuatu dengan tangan sendiri, Nak. OmniCloud boleh menawarkan awan — kita punya akar.',
            ]
          : [
              'Ah, cucu Kakek sudah pulang. Aku Pak Tua Query, penjaga arsip desa. Dulu semua catatan Bit-Terra rapi di akar Pohon Induk — sampai The Great Rollback mengacaknya sepuluh tahun lalu.',
              'Ingat ini, Nak: data yang baik itu seperti kebun. Dipilih yang perlu (SELECT), diambil dari tempatnya (FROM), disaring yang relevan (WHERE). Sisanya… kompos.',
            ];
      if (q1 && q2 && !q6) {
        lines.push(
          'Festival Panen Raya sebentar lagi, Nak. Kasnya masih selisih — dua buku yang tidak mau bicara satu sama lain. Temui aku di plaza festival; kita gabungkan mereka dengan cara yang benar.',
        );
      }
      if (q8) {
        lines.push(
          'Akar Pohon Induk berdenyut tenang sekarang, dan berbunga. Sepuluh tahun ia menunggu seseorang sepertimu, Nak. Cloud datang dan pergi — akar tinggal.',
        );
      }
      return { name: 'Pak Tua Query', lines };
    }
    case 'flora_fields_done':
      return {
        name: 'Papan Catatan Panen',
        lines: [
          'Di papan ini sekarang terpampang urutan panen terbaik desa, ditulis tangan oleh Bibi Flora dengan spidol hijau: 1. Pak Dulah — Padi, 96 kg. 2. Pak Dulah — Kedelai, 91 kg. 3. Cici — Jagung, 84 kg.',
          'Di bawahnya ada catatan kecil: "Ditetapkan dari data, bukan dari debat. — B.F."',
        ],
      };
    case 'festival_done':
      return {
        name: 'Plaza Festival',
        lines: [
          'Kios-kios festival mulai dibuka kainnya satu per satu. Di meja Pak Tua Query, dua buku besar itu sekarang terikat jadi satu dengan tali akar, dan halaman pertamanya bertuliskan: "Kas Festival — sudah diaudit, cocok sampai rupiah terakhir."',
        ],
      };
    case 'great_commit_done':
      return {
        name: 'Akar Pohon Induk',
        lines: [
          'Akar raksasa itu berdenyut pelan dan hangat, dan di sela-selanya bunga-bunga kecil berwarna matahari bermekaran — untuk pertama kalinya dalam sepuluh tahun.',
          'Piko duduk bersandar di akar, layar wajahnya menampilkan ^ ^ yang sangat puas. "Desa ini ingat semuanya lagi, Fixer. Semuanya."',
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
        lines: q3
          ? [
              'Pintu air bergerak ringan sekarang, membuka dan menutup mengikuti bacaan sensor tanah — persis aturan yang kamu tuliskan untuk Piko.',
              'Di bawahnya air mengalir tertib ke ladang. Cici menempelkan stiker kecil di tiangnya: "Dijaga Piko. Jangan diganggu."',
            ]
          : [
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
        lines: q5
          ? [
              'Sabuk konveyor berputar lagi dengan dengung senang, dan rak pemuatan di timur penuh peti roti yang tersusun rapi di petak bintangnya.',
              'Bau roti hangat keluar dari celah pintu. Roti terakhir yang dulu keras seperti batu bata sudah diganti adonan baru — festival kali ini tidak kekurangan sarapan.',
            ]
          : [
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
        lines: q7
          ? [
              'Akar-akar raksasa sudah minggir memberi jalan, dan dua belas tunas kristal di lorongnya berdiri segar berkilau. Jalan menuju Jembatan Kristal terbuka lagi.',
              'Papan kecil di tiangnya kini bertambah satu baris tulisan baru, tangan Bibi Flora: "Sudah aman. Yang menyiram boleh lewat."',
            ]
          : [
              'Dua akar raksasa melengkung membentuk gerbang. Di baliknya, lorong gelap berliku menuju Jembatan Kristal — jalan pintas lama ke tambang yang putus sejak Rollback.',
              'Papan kecil di tiangnya berbunyi: "Belum aman. Pulang dulu, perbaiki desa. — K." Kakek selalu singkat kalau sedang khawatir.',
            ],
      };
    default:
      return null;
  }
}
