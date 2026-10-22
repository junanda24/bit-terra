# Balance — Ekonomi Fokus (Brain Fog) — 2026-10-22

**Maksud (BLUEPRINT §6):** "Focus bar: error saat Run mengurangi Focus; habis → Piko sarankan istirahat" — ketegangan ringan yang mendorong istirahat, BUKAN hukuman; sejalan filosofi brief "kebebasan bereksperimen tanpa takut salah".
**Target terukur:** (1) tidak ada keadaan di mana progres terblokir oleh fokus; (2) pemain yang gigih tapi berjuang selalu punya jalan memulihkan fokus yang TIDAK mensyaratkan sukses di quest yang sedang menjebaknya; (3) profil santai/tipikal tidak pernah menyentuh fokus 0.

## Rumus & aturan terkirim (dikutip dari kode)

| Parameter | Nilai / aturan | Sumber |
| --- | --- | --- |
| Fokus awal / maks | 100 | `FOCUS_MAX`, gameStore |
| Pajak gagal | −10, HANYA bila kode sudah diubah dari kerangka DAN linter bersih saat RUN | `focusPolicy.shouldDeductFocusOnFail` |
| Gagal gratis | kerangka belum disentuh; error yang sudah diperingatkan linter (RUN digerbang linter); error runtime SQL (terklasifikasi); run terkontaminasi tulis → rollback; watchdog bot | CyberDeckScreen + focusPolicy |
| Hadiah sukses | +20, HANYA penyelesaian pertama per quest | `completeQuest` → boolean (audit CORE-H1) |
| Petunjuk | selalu gratis, berputar 3 level | `handleHint` |
| Replay quest selesai | tanpa hadiah, tanpa kunci | gameStore |
| Gerbang keras di fokus 0 | **TIDAK ADA** — tidak satu pun kode menonaktifkan RUN/misi berdasarkan fokus; bar hanya berubah warna + teks saran ≤30 | FocusBar, grep menyeluruh `src/` |

Aliran per quest (pemain berjuang, f = gagal terpajak sebelum sukses): Δ = +20 − 10f. Titik impas f = 2; di atas itu quest menguras fokus neto — wajar untuk ketegangan, berbahaya hanya bila tidak ada sumber lain.

## Simulasi (wajib, bisa diulang)

Skrip: `src/core/bridge/focusRest.test.ts` (describe "simulasi ekonomi Fokus") — PRNG mulberry32 ber-seed, 1000 sesi × 8 quest per profil. Profil = rentang gagal-RUN memenuhi-syarat-pajak per quest (P25: 0–1, P50: 1–3, P75: 3–6, P95: 6–10); 35% gagal dimodelkan gratis (proporsi kelas bebas-pajak pada transkrip playtest ronde 1).

| Profil | Rezim | Menyentuh 0 | Median fokus min | Median fokus akhir | Fokus mulai quest terendah |
| --- | --- | --- | --- | --- | --- |
| P25 santai | dua-duanya | 0% | 90 | 100 | 100 |
| P50 tipikal | dua-duanya | 0% | 70 | 100 | 70 |
| P75 berjuang | tanpa istirahat | — | — | — | — |
| P75 berjuang | dengan istirahat | 24,6% (di tengah quest) | 10 | 50 | **50** |
| P95 berjuang berat | **tanpa istirahat** | **100%** | **0** | **20** | **20** |
| P95 berjuang berat | dengan istirahat | 99,9% (di tengah quest) | 0 | 20 | **50** |

**Vonis pra-perbaikan: soft-strand TERBUKTI untuk target (2).** Tanpa istirahat, 100% sesi P95 menyentuh 0 dan memainkan sisa game dari fokus mulai-quest 20 — satu-satunya pemulihan adalah +20 dari quest yang sedang menjebak mereka. Target (1) lulus (tidak ada gerbang), target (3) lulus; tetapi bar yang terparkir merah + teks "istirahat" tanpa mekanisme istirahat adalah sudut pemidanaan yang dimaksud temuan F-04 ronde 1 — separuhnya sudah ditutup gelombang perbaikan (kebijakan memaafkan), separuhnya (pemulihan) belum.

## Perbaikan yang dikirim (putaran tuning 1)

**Istirahat desa** — `src/core/bridge/focusRest.ts`, dirangkai di `App.tsx` (interval) dan diuji terhadap store sungguhan:

| Konstanta | Nilai | Alasan bentuk |
| --- | --- | --- |
| `FOCUS_REST_CAP` | 50 | Setengah bar: "cukup segar untuk mencoba lagi" (≥5 gagal terpajak per quest) tanpa menyaingi hadiah quest (maks 100) |
| `FOCUS_REST_PER_TICK` | +2 | Bar terlihat bergerak setiap ketukan — umpan balik istirahat yang terasa |
| `FOCUS_REST_TICK_MS` | 5000 | 0→50 ≈ 2 menit berkeliling desa ≈ satu putaran menyapa NPC |

Sinyal kehadiran desa = `codingMode === false` di game store (deck tertutup) — tanpa menyentuh scene Phaser. Fokus di atas batas tidak digerakkan (istirahat bukan sumber tak terbatas dan bukan penguras). Teks saran FocusBar diperbarui agar menyebut mekanisme yang sekarang benar-benar ada.

**Hasil sesudah perbaikan:** properti anti-terjebak terpenuhi di semua profil — fokus mulai quest terendah = 50 (atau lebih tinggi bila dibawa hasil quest), dibuktikan assertion simulasi. P95 masih bisa menyentuh 0 DI TENGAH satu quest (6–10 gagal terpajak dalam satu quest memang menghabiskan 50+), tetapi jalan pulangnya tidak lagi mensyaratkan sukses: tutup deck, ±2 menit di desa, kembali 50.

## Catatan rampa kesulitan (pengamatan, bukan perubahan angka)

| Quest | Konsep baru | Panjang solusi rujukan | Catatan |
| --- | --- | --- | --- |
| Q1 | urutan perintah (3 panggilan) | 3 baris | — |
| Q2 | SELECT + WHERE | 1 query | — |
| Q3 | if/else + sensor | ±7 baris (2 blanko di kerangka) | ambang `<= 40` ikut lulus — nilai batas 40 tak pernah jadi bacaan sensor (25/85); tidak apa, pelajaran cabangnya sampai |
| Q4 | ORDER BY + LIMIT | 1 query | — |
| Q5 | for + function + dorong peti | **±24 pernyataan** | **Terpanjang di game.** Pelajarannya (loop) hanya pola dorong-4; sisanya koreografi ganti lajur manual ×2 yang mendominasi. Label MEDIUM meremehkan panjang eksekusinya — lihat temuan PT2-F7 di playtest ronde 2 |
| Q6 | JOIN + WHERE dua saringan | 1 query | petunjuk menyebut jebakan `>` vs `>=` secara eksplisit — bagus |
| Q7 | loop bersarang | ±11 baris | elegan: pola di dalam pola terbaca dari geometri |
| Q8 | UPDATE sah + final hibrida | 2 statement + 3 baris | fase 2 sengaja memanggil kembali Q1 (buku ditutup oleh pola pertama) |

Petunjuk ketiga quest baru diaudit baris demi baris: semua nama tabel/kolom/nilai yang disebut petunjuk Q4 (`panen_logs`, `berat_kg`, `musim='Kemarau'`), Q6 (`anggota_festival`, `kas_festival`, `anggota_id`, `kategori='Sewa Stan'`, `> 150000`), Q8 (`omni_sync_logs`, `CORRUPT`/`SYNCED`, PENDING/OFFLINE) cocok dengan seed dan solusi — tidak ada petunjuk yang berbohong.

---
*Pembuat: game-balance-designer (pass Fase 4 / Tahap D2). Bukti: `src/core/bridge/focusRest.test.ts` (8 tes: fungsi murni, store sungguhan, simulasi 1000 sesi × 4 profil × 2 rezim).*
