# Bit-Terra: The Great Rollback

Game edukasi coding & SQL berbasis web yang **bisa dijelajahi** seperti game
farming klasik. Kamu adalah mantan programmer kota yang mewarisi bengkel
kakek di Desa Bit-Terra — desa solarpunk yang sistem otomasi desanya rusak
sejak insiden "The Great Rollback". Berjalan-jalanlah di desa, sapa
warganya, lalu colokkan Cyber-Deck dan perbaiki desa satu baris kode sekali
jalan — sebelum OmniCloud Corp mengambil alih lahan warga. Setiap misi yang
tuntas mengubah desa secara terlihat: lampu bengkel menyala, domba pulang
ke kandang, pintu air mengalir lagi, Pohon Induk berbunga.

Prinsip desainnya: pemain harus **lupa bahwa mereka sedang belajar**. Cerita
yang punya hati, umpan balik yang juicy, dan gagal yang lucu — tidak ada
layar error yang menghukum. Salah `WHERE` saat mencari domba? Ayam-ayam
desa yang berkumpul di balai desa.

**Main sekarang: https://bit-terra.vercel.app**

## Status: Fase 1–3 selesai — game lengkap 8 quest

Desa Bit-Terra bisa dijelajahi bebas (peta 40×30 petak di Phaser, WASD/panah
atau joystick sentuh), berisi bengkel Kakek, kandang Pak Rani, kebun Bibi
Flora, pintu air, gudang roti, plaza festival, dan Gerbang Akar. Delapan
quest terhubung dalam **rantai progresi berurutan** — quest berikutnya
terbuka setelah yang sebelumnya tuntas, dan wilayah yang masih tertutup
menjawab lewat kabut otak yang menyebut persis apa yang harus diselesaikan.

| # | Quest | Mode | Konsep yang diajarkan | Tingkat |
| --- | --- | --- | --- | --- |
| Q1 | Bangun, Piko! | Bot | Urutan perintah (boot → jalan → isi daya) | Mudah |
| Q2 | Domba yang Tersesat | SQL | `SELECT` + `WHERE` | Mudah |
| Q3 | Pintu Air Kemarau | Bot | `if/else` membaca sensor — skrip yang sama diuji di dua cuaca | Sedang |
| Q4 | Teras Sawah | SQL | `ORDER BY` + `LIMIT` | Sedang |
| Q5 | Ban Berjalan Roti | Bot | Loop `for` + `function`, mendorong peti ke rak | Sedang |
| Q6 | Festival Panen Raya | SQL | `JOIN` dua tabel + `WHERE` dua saringan | Sulit |
| Q7 | Labirin Akar | Bot | Loop bersarang + kompas (belok) + menyiram | Sulit |
| Q8 | Magang di OmniCloud | Campuran | Fase 1: `UPDATE` yang sah untuk memperbaiki data rusak · Fase 2: urutan final di akar Pohon Induk | Sulit |

Sistem pendukung yang hidup di dalamnya:

- **Cyber-Deck** — editor CodeMirror 6 dengan linter real-time yang
  menyarankan nama kolom/fungsi yang benar ("apakah maksudmu…?"), tuas RUN
  fisik, partikel + suara ketikan mekanik, dan panel catatan Piko.
- **Fokus (Brain Fog) yang memaafkan** — gagal hanya memotong fokus bila
  kesalahannya konseptual (kode sudah diubah & linter bersih); kesalahan
  yang sudah diperingatkan linter, error runtime, dan eksperimen tulis
  yang di-rollback semuanya gratis. Menyelesaikan misi memulihkan fokus,
  petunjuk selalu gratis, dan beristirahat berkeliling desa memulihkan
  fokus pelan-pelan sampai separuh.
- **Musik adaptif** dua lapis (akustik desa ↔ chiptune ngoding), 100%
  disintesis WebAudio — tidak ada berkas audio.
- **Save otomatis** (IndexedDB) + ekspor/impor berkas `.bitterra`.
- **Self-healing** — mode degradasi jujur saat mesin data gagal menyala,
  panel Periksa Kesehatan, watchdog eksekusi, dan pemulihan sesi.

## Arsitektur

Hybrid Canvas + DOM: Phaser menangani desa yang bisa dijelajahi, React 19 +
TypeScript menangani Cyber-Deck & UI (teks tajam). Kontrak keras:

- **SQLite asli di browser** — SQL.js (WASM, dilayani lokal) menjalankan
  query pemain apa adanya; validasi dari *result set*, bukan mencocokkan
  teks query. Quest baca-saja berjalan di atas snapshot: statement tulis
  boleh terlihat efeknya, lalu database **dipulihkan otomatis**
  (auto-rollback) dan tidak bisa menuntaskan quest.
- **Zero `eval()` secara konstruksi** — kode bot diinterpretasikan dari AST
  (Acorn) oleh StepInterpreter; kode pemain hanya bisa memanggil fungsi
  yang diciptakan sandbox sendiri, objek sensor hanya-baca, dan ada
  anggaran langkah total + LoopGuard 500 iterasi — tab tidak akan pernah
  beku dan halaman tidak bisa dicemari dari dalam game.
- **Data-driven quests** — setiap quest adalah berkas konfigurasi
  (`src/content/quests/`) yang mematuhi `QuestDefinition`; menambah quest
  tidak menyentuh engine. Solusi rujukan setiap quest dibuktikan lulus
  oleh tes yang menjalankan mesin sungguhan.
- **Isolasi 3 layer** — engine (sandbox SQL/script, dunia Phaser) ↔ bridge
  (Zustand + mitt EventBus) ↔ UI; UI tidak pernah memutasi dunia secara
  langsung. Keadaan desa adalah fungsi murni dari quest yang selesai —
  tidak ada migrasi skema save.

Dokumen lengkap: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) (TDD/GDD),
[`docs/BRIEF-STORY.md`](docs/BRIEF-STORY.md) (cerita & filosofi),
[`docs/PLAYTEST-FASE1.md`](docs/PLAYTEST-FASE1.md) (playtest ronde 1:
verdict FIX-FIRST, 12 temuan — semua HIGH/MED ditutup),
[`docs/PLAYTEST-FASE3.md`](docs/PLAYTEST-FASE3.md) (playtest ronde 2:
verdict SHIP-SLICE, 53 kasus simulasi),
[`docs/BALANCE-FOKUS-2026-10-22.md`](docs/BALANCE-FOKUS-2026-10-22.md)
(balance ekonomi Fokus + simulasi 1000 sesi),
[`docs/AUDIT-FASE1-2026-10-22.md`](docs/AUDIT-FASE1-2026-10-22.md)
(audit penuh Fase 1 + gelombang perbaikannya).

## Pengembangan

```bash
npm install
npm run dev      # server pengembangan
npm run build    # build produksi (tsc + vite)
npm test         # 341 tes (sandbox SQL & script, core, dunia, konten, integrasi)
```

## Batasan yang jujur

- **Seni 100% prosedural** — tekstur dan sprite desa digambar dari kode
  saat boot (palet blueprint), bukan aset gambar; tidak ada berkas seni
  biner di repo ini.
- **Belum ada QA visual/feel otomatis** — Phaser tidak bisa di-boot tanpa
  layar di lingkungan CI kami, jadi rasa gerak, framing kamera, dan
  tampilan akhir diverifikasi manual di perangkat pemain; yang dijamin
  tes adalah logika, tipe, dan perilaku mesin (341 tes hijau).
- **Chunk Phaser ±1,37 MB (gzip ±357 kB)** dimuat malas dan terpisah —
  hanya dibayar saat desa dibuka, bukan oleh Cyber-Deck.
- **Chunk utama masih besar (±3,5 MB)** karena membawa grammar parser SQL
  untuk banyak dialek; tercatat sebagai utang audit ARCH-M1.
- Bahasa UI Indonesia; belum ada lokalisasi lain.

## Roadmap (blueprint)

- **Fase 1** — Cyber-Deck Sandbox Prototype (Q1–Q2). ✔
- **Fase 2** — Desa Phaser yang bisa dijelajahi; quest pindah ke rumahnya
  di dunia. ✔
- **Fase 3** — Q3–Q8 + kunci progres berurutan + final HYBRID. ✔
- **Fase 4** — pencahayaan siang–malam & poles visual, balance pass,
  playtest ronde 2. (Berlangsung — lihat dokumen balance & playtest di atas.)
