# Bit-Terra: The Great Rollback

Game edukasi coding & SQL berbasis web. Kamu adalah mantan programmer kota yang
mewarisi bengkel kakek di Desa Bit-Terra — desa solarpunk yang sistem otomasi
desanya rusak sejak insiden "The Great Rollback". Bersama robot pendamping
**Piko**, perbaiki desa satu baris kode sekali jalan, sebelum OmniCloud Corp
mengambil alih lahan warga.

Prinsip desainnya: pemain harus **lupa bahwa mereka sedang belajar**. Cerita
yang punya hati, umpan balik yang juicy, dan gagal yang lucu — tidak ada layar
error yang menghukum. Salah `WHERE` saat mencari domba? Ayam-ayam desa yang
berkumpul di balai desa.

**Main sekarang: https://bit-terra.vercel.app**

## Status: Fase 1 — Cyber-Deck Sandbox Prototype (selesai)

Dua quest yang bisa dimainkan penuh:

- **Q1 "Bangun, Piko!"** (Bot Script) — hidupkan Piko dengan perintah berurutan
  `piko.boot()`, `piko.moveForward(3)`, `piko.charge()`. Kode dieksekusi baris
  demi baris dan robot bergerak selaras dengan baris yang menyala.
- **Q2 "Domba yang Tersesat"** (SQL) — cari 3 domba hilang dari tabel
  `livestock_logs` dengan `SELECT ... WHERE ...` di mesin SQLite asli.

Di dalamnya sudah hidup: editor Cyber-Deck (CodeMirror 6) dengan linter
real-time yang menyarankan nama kolom yang benar, partikel + suara ketikan
mekanik, tuas RUN fisik, musik adaptif dua lapis (akustik desa ↔ chiptune
ngoding), sistem Focus yang pemaaf, save otomatis (IndexedDB) + ekspor/impor
file `.bitterra`, dan self-healing (mode degradasi jujur saat mesin data gagal
menyala, panel Periksa Kesehatan, watchdog eksekusi).

## Arsitektur

Hybrid Canvas + DOM: React 19 + TypeScript menangani Cyber-Deck & UI (teks
tajam), dunia pixel-art menyusul di Phaser 3 pada Fase 2. Kontrak keras:

- **SQLite asli di browser** — SQL.js (WASM) menjalankan query pemain apa
  adanya; validasi dari *result set*, bukan mencocokkan teks query.
- **Zero `eval()`** — kode bot diinterpretasikan dari AST (Acorn) oleh
  StepInterpreter generator; LoopGuard 500 iterasi, tab tidak akan pernah beku.
- **Data-driven quests** — setiap quest adalah file konfigurasi
  (`src/content/quests/`) yang mematuhi `QuestDefinition`; menambah quest
  tidak menyentuh engine.
- **Isolasi 3 layer** — engine ↔ bridge (Zustand + mitt EventBus) ↔ UI;
  UI tidak pernah memutasi dunia secara langsung.

Dokumen lengkap: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) (TDD/GDD),
[`docs/BRIEF-STORY.md`](docs/BRIEF-STORY.md) (cerita & filosofi),
[`docs/PLAYTEST-FASE1.md`](docs/PLAYTEST-FASE1.md) (evaluasi playtest:
12 temuan, semua HIGH/MED ditutup).

## Pengembangan

```bash
npm install
npm run dev      # server pengembangan
npm run build    # build produksi
npx vitest run   # 112 tes (sandbox SQL, interpreter, core, UI, integrasi)
```

## Roadmap (blueprint)

- **Fase 2** — Phaser 3: peta Grandpa's Workshop & Farm (Tiled), CommandQueueRunner.
- **Fase 3** — Q3–Q8 (pintu air, JOIN festival, hingga final "The Great Commit"),
  audio adaptif penuh, persistence polish.
- **Fase 4** — shader lighting siang-malam & CRT, balancing, playtest lanjutan.
