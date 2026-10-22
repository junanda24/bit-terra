# Playtest — Bit-Terra Fase 1 (Cyber-Deck Sandbox Prototype) — 2026-10-22

**Baseline:** commit `0bbc555` (+ file self-healing yang belum ter-commit di working tree), 68/68 tes hijau, build hijau.
**Verdict keseluruhan: FIX-FIRST** — slice ini benar-benar bisa dimainkan dan sering kali menyenangkan, tetapi dua cacat sistemik (pelajaran urutan Q1 bisa diakali + narasi gagal yang salah menyebut penyebab) melemahkan tepat dua hal yang menjadi alasan game ini ada: mengajarkan logika urutan, dan membuat gagal terasa lucu sekaligus mendidik. Keduanya murah diperbaiki.

## Metode & batas lingkungan (jujur)

Game **tidak** dirender di browser sungguhan: headless browser di mesin ini tidak bisa menjangkau localhost, jadi tidak ada screenshot / playthrough visual. Evaluasi dilakukan lewat tiga jalur bukti:

1. **Kode** `src/ui/**`, `src/content/**`, `src/core/**`, `src/sandbox/**` dibaca penuh untuk jalur yang menghadap pemain.
2. **Tes integrasi & modul** yang ada (`src/integration.test.ts` + 68 tes) sebagai bukti perilaku.
3. **Simulasi sesi pertama terprogram**: harness vitest sementara (dihapus setelah dipakai; tidak ada perubahan kode) menjalankan **sandbox asli** (SqliteWasmRunner + SqlAstLinter + ResultDiffChecker untuk Q2; ScriptLinter + StepInterpreter untuk Q1) dengan input pemula yang realistis — termasuk 9 kesalahan khas pemula di Q1 dan 10 di Q2 — lalu menerapkan **logika verdict yang sama persis** dengan `CyberDeckScreen.tsx` (pemilihan kunci reaksi di `finalizeSql`/`runBot`, fallback `funnyFail`) dan semantik `BotGridStage.handleAction`. Transkrip di §4 adalah keluaran harness itu.

Akibatnya: angka "waktu" di bawah ini dihitung dari **jumlah aksi/edit** menuju sukses, bukan stopwatch playthrough. Penilaian rasa visual (apakah animasi terasa enak) tidak bisa diverifikasi di sini — yang dinilai adalah keberadaan, pemicu, dan isi setiap umpan balik dari kodenya.

## Verdict per heuristik

| Heuristik | Verdict | Ringkasan bukti |
| --- | --- | --- |
| Kejelasan tujuan | **PASS** | Kartu picker menampilkan tujuan; layar deck punya kotak cerita + baris "Tujuan:" eksplisit; komentar kerangka menyebut koordinat & langkah. Pemain baru bisa menyebut tujuannya dalam <10 detik di kedua quest. |
| Waktu-menuju-sukses-pertama | **PASS** | Q1 = 2 isian kosong + RUN; Q2 = 2 isian kosong + RUN; hint level 3 = solusi utuh dalam 3 klik tombol petunjuk. |
| Feedback juice | **PASS WITH NOTES** | Inventaris kaya (lihat §3). Titik mati: sisipan cartridge tak terlihat mendarat di mana; `onSuccessWorldEvents` tidak pernah di-emit; tombol petunjuk tanpa SFX. |
| Rampa kesulitan Q1 → Q2 (+ kesiapan Q3) | **PASS WITH NOTES** | Lembut dan terstruktur (cartridge menggerbang kosakata; API gate/sensor sudah disiapkan untuk Q3). Catatan: urutan quest tidak dikunci (F-11). |
| Keadaan gagal (lucu + mendidik?) | **PASS WITH NOTES** | Mayoritas reaksi pas & lucu (ayam balai desa, Piko mematung). Tetapi 5 dari 19 kesalahan simulasi mendapat narasi yang **salah menyebut penyebab** (F-02, F-05, F-06) — di game yang gurunya adalah narasi, itu cacat inti. |
| Sistem Fokus vs "tanpa takut salah" | **FAIL** | −10 per gagal-RUN bersifat permanen (tersimpan otomatis), tanpa mekanisme istirahat, tanpa keadaan nol — lihat F-04 + F-09. |
| Piko sebagai guru | **PASS WITH NOTES** | Linter adalah permukaan mengajar terbaik (spesifik, bernomor baris, ada saran "apakah maksudmu"). Narasi jalur-RUN kadang mengkhianatinya (F-02, F-07); dialog hasil karya penulis tidak pernah tampil (F-03). |

## Temuan (findings)

### HIGH

**F-01 — Pelajaran utama Q1 (urutan perintah) bisa diakali: `boot()` ditulis terakhir tetap SUKSES.**
Simulasi M4 (`piko.moveForward(3)` → `piko.charge()` → `piko.boot()`): verdict **SUKSES**. Penyebab: `BotGridStage.handleAction` tidak memeriksa status `awake` untuk aksi `move`/`charge` — Piko berjalan dan mengisi daya sambil "tertidur" — dan verdict di `CyberDeckScreen.runBot` hanya memeriksa flag akhir pose (`awake && onTarget && charged`). Padahal storyContext, komentar kerangka, dan hint 1 Q1 semuanya menegaskan "selalu mulai dengan boot(). Urutan perintah itu penting." Quest pertama game ini mengajarkan sequencing, tetapi sequencing tidak ditegakkan. *(Pemilik: gameplay-engineer.)*

**F-02 — Charge di luar petak cahaya dinarasikan sebagai tabrakan rintangan (3 dari 9 kesalahan bot).**
Simulasi M1 (jalan 5 petak, berhenti bersih, charge di tempat gelap), M5 (charge dulu di pojok start), M6 (kurang 1 petak lalu charge) — ketiganya berakhir dengan teks *"Piko menabrak tumpukan kayu bakar…"*, padahal tidak ada rintangan yang disentuh. Rantai penyebab: `BotGridStage.tsx` kasus `'charge'` memanggil `flashDizzy()` saat di luar target (bintang pusing = sinyal tabrakan) → `CyberDeckScreen` mengunci `crashedRef = true` untuk pose pusing apa pun → rantai verdict memeriksa `crashed` **sebelum** logika posisi/charge, sehingga `hit_obstacle` selalu menang. Pemain yang salah jarak justru diajari bahwa ia menabrak sesuatu. *(Pemilik: gameplay-engineer + game-designer untuk teks reaksi baru `not_on_target`.)*

**F-03 — Sistem dialog yang ditulis khusus untuk Q1/Q2 tidak pernah ditampilkan; reward dunia tidak pernah terjadi.**
`getQuestDialogue` / `Q1_Q2_DIALOGUES` (`src/content/dialogues/q1_q2_dialogues.ts`, 144 baris) tidak diimpor oleh file mana pun di luar dirinya (grep bersih). Akibatnya pemain tidak pernah melihat: dialog intro (surat Kakek, panik Pak Rani), dialog sukses — termasuk momen emosional Pak Rani menyebut nama ketiga dombanya — dan baris funnyFail khusus. Yang tampil sebagai gantinya: `storyContext` sebagai teks statis, dan sukses selalu ditutup kalimat generik yang sama: *"Berhasil! Misi … tuntas. Kerja bagus, Fixer."* (`CyberDeckScreen.successPath`). Nasib sama untuk `onSuccessWorldEvents` (`PIKO_AWAKENS`, `SHEEP_RETURN`, …): hanya ada di definisi tipe + data quest, tidak pernah di-emit atau dikonsumsi — domba tidak pernah "berlari pulang" dalam bentuk apa pun. Ini melemahkan pilar brief #1 (cerita yang punya hati) dan reward visual yang dijanjikan BLUEPRINT §6. *(Pemilik: gameplay-engineer untuk plumbing; kontennya sudah ada.)*

### MED

**F-04 — Fokus adalah ratchet satu arah yang permanen, tanpa istirahat dan tanpa keadaan nol.**
Setiap gagal-RUN memotong fokus −10 (`CyberDeckScreen.funnyFail` → `gameStore.adjustFocus`, termasuk untuk error interpreter dan error sintaks), dan fokus adalah bagian dari progres yang **tersimpan otomatis** (`selectPersistedProgress`). Tidak ada satu pun jalur memulihkannya: `resetProgress` ada di store tetapi tidak dirujuk oleh satu pun file `.tsx` (grep bersih). Teks saran istirahat di `FocusBar` (muncul ≤30) hanya pajangan — menyebut Kafe Byte & Bean / sungai / bengkel yang belum ada di Fase 1, tanpa tombol atau aksi. Di fokus 0 tidak terjadi apa-apa: tidak ada dialog istirahat dari Piko seperti dijanjikan BLUEPRINT §6. Sesi pemula realistis dari simulasi (kerangka disentuh, satu modul khayalan, lupa charge, kurang satu petak, tanpa-WHERE, status huruf kecil) menghabiskan ±60 fokus dalam dua quest pertama — dan pemain yang *sengaja* mencoba gagal lucu (perilaku yang justru diinginkan brief!) membayar 10 fokus per tawa, selamanya. Ini bertabrakan langsung dengan filosofi "kebebasan bereksperimen tanpa takut salah". *(Pemilik: game-balance-designer + gameplay-engineer.)*

**F-05 — Q2 tidak punya reaksi `wrong_result`; jawaban "bentuknya benar, isinya salah" mendapat teks yang bertentangan dengan layar.**
Simulasi M7 (`… LIMIT 3` tanpa WHERE — tepat 3 baris): kunci verdict `wrong_result` tidak ada di `onFailFunnyReactions` Q2, sehingga `funnyFail` jatuh ke `Object.values(reactions)[0]` = teks `too_many_rows` tentang undangan terbuka untuk SEMUA hewan — padahal pemain melihat tepat 3 baris hasil. *(Pemilik: game-designer — cukup tambah satu kunci reaksi + pertimbangkan fallback yang lebih aman di `finalizeSql`.)*

**F-06 — Teks `wrong_column` mengklaim kolom "tidak pernah ada" untuk dua kasus pemula paling umum.**
Simulasi M5 (`SELECT *`) dan M6 (hanya `sheep_name`): keduanya memicu `wrong_column`, yang teksnya berbunyi *"Kolom yang kamu minta tidak pernah ada di catatan kalung domba… dari dulu."* Untuk M5 pemain meminta kolom yang semuanya ada (kelebihan); untuk M6 kolomnya ada (kekurangan satu). Narasi mengajarkan model mental yang salah tentang kesalahan sendiri. *(Pemilik: game-designer — bedakan "kebanyakan kolom" / "kurang kolom" atau tulis ulang teksnya agar netral jumlah.)*

**F-07 — Jalur RUN membuang presisi linter; pemain membaca diagnosis yang lebih buruk setelah menekan tuas.**
Simulasi M4/M8 Q2 (typo `nama_domba` / `livestock_log`): saat mengetik, linter memberi diagnosis tepat + saran (*"apakah maksudmu `sheep_name`?"*). Setelah RUN, gelembung Piko justru menampilkan teks generik `syntax_error` tentang "susunan kalimat perintahmu" — padahal masalahnya satu kata yang salah nama, bukan susunan. Pola sama di bot: saran linter untuk `moveFoward` (*"Apakah maksudmu piko.moveForward()?"*) hilang di jalur RUN karena `CyberDeckScreen.runBot` hanya memakai `err.message`, bukan `err.suggestion`. Panel "Catatan Piko" memang tetap menampilkan versi tepatnya, tetapi gelembung bicara — permukaan yang paling dibaca — adalah versi yang salah arah. *(Pemilik: gameplay-engineer.)*

**F-08 — Klik cartridge menempelkan snippet di AKHIR dokumen, bukan di kursor.**
`CyberDeckScreen.handleInsert` selalu `setCode(cur + sep + snippet)`. Di Q2, mengklik cartridge `WHERE` saat kerangka sudah punya baris WHERE menambahkan fragmen `WHERE ` menggantung di bawah titik-koma → kekacauan sintaks instan. Di Q1, mengklik `moveForward()` setelah solusi lengkap menambahkan `piko.moveForward(1);` **setelah** `charge()` — mengubah semantik dan bisa mengubah quest yang sudah benar menjadi gagal pada RUN berikutnya. Mekanik yang diiklankan sebagai bantuan justru melawan pemain yang bereksperimen dengannya. *(Pemilik: gameplay-engineer.)*

### LOW

**F-09 — Menjalankan kerangka yang belum disentuh dikenai biaya fokus penuh di kedua quest.**
Simulasi S0 Q1 + S0 Q2: tarikan tuas pertama — aksi paling wajar bagi pemain baru yang penasaran — dijamin gagal (blank `___` memang invalid) dan dikenai −10 seperti kesalahan sungguhan. Linter sebenarnya sudah tahu kode itu belum selesai sebelum RUN; mengenakan biaya untuk itu adalah hukuman ganda atas rasa ingin tahu. *(Pemilik: game-balance-designer — mis. jangan potong fokus bila kode masih mengandung blank templat.)*

**F-10 — Saran linter membocorkan modul nonsense `gate.boot`, `gate.moveForward`, `gate.charge`.**
Transkrip S0/M7 Q1: daftar "Modul yang Piko punya sekarang" memuat `gate.charge` dst. — hasil ekspansi `allowedBotFunctions` di `CyberDeckScreen` yang menambahkan varian `piko.*` **dan** `gate.*` untuk setiap cartridge polos. Kebisingan persis di pesan yang seharusnya mengorientasikan pemula. *(Pemilik: gameplay-engineer.)*

**F-11 — Tidak ada penguncian urutan quest; Piko yang belum dibangunkan menjadi host Q2.**
Kedua kartu quest aktif sejak awal (`App.tsx` picker). Pemain bisa membuka Q2 lebih dulu, di mana Piko — yang secara cerita masih tertidur kehabisan daya sampai Q1 selesai — berbicara dan mengawasi editor seperti biasa. Rampa Q1→Q2 bergantung sepenuhnya pada disiplin pemain. *(Pemilik: game-designer — kunci Q2 sampai Q1 selesai, atau terima sebagai kebebasan dan sesuaikan dialog.)*

**F-12 — Kebohongan kecil kode↔dunia.**
(a) `moveForward(0)` dan nilai negatif di-clamp menjadi 1 langkah oleh `BotGridStage` (`Math.max(1, …)`) — kode bilang 0, robot tetap melangkah; ini akan menggerogoti kepercayaan saat pelajaran loop tiba. (b) Label status panggung bisa menampilkan "Daya terisi penuh" saat Piko belum pernah di-boot (kasus M9: charge di target saat tertidur mengeset `charged=true`, dan label memprioritaskan `charged` di atas `awake`). *(Pemilik: gameplay-engineer.)*

## Inventaris feedback juice (bukti per interaksi)

| Momen | Feedback yang benar-benar ada | Bukti |
| --- | --- | --- |
| Mengetik | Bunyi klik mekanik synth per tombol (non-modifier); 3–5 partikel pixel di koordinat kursor; penghitung streak muncul ≥8 ketukan, reset saat Backspace/blur | `InteractiveEditor.tsx` handler keydown + `TypingParticleCanvas` |
| Linter (150 ms debounce) | Penanda garis di editor; panel "Catatan Piko" (maks 3, saran berwarna mint); lampu deck amber → hijau → berjalan | `CyberDeckScreen` + `CyberDeckFrame` lampState |
| Klik cartridge | SFX snap + getar (per brief komponen) — **tetapi** titik mendarat snippet tak terlihat (F-08) | `CartridgeBar` / `handleInsert` |
| Tarik tuas RUN | SFX tuas mekanis; tuas bisa didrag; terkunci selama berjalan | `RunLever.tsx` |
| Bot berjalan | Highlight baris aktif sinkron (`STEP_HIGHLIGHT`); jeda ±430 ms per panggilan; token bergerak spring per petak; petak matahari berdenyut; bintang pusing + goyang saat tabrak; label status ("Piko tertidur/aktif/Daya terisi penuh"); cahaya glow saat charged | `CyberDeckScreen.runBot` + `BotGridStage` |
| SQL berjalan | Sapuan pindai 95 ms/baris + label progres "Memindai baris x / 12"; baris cocok menyala mint dan masuk tabel hasil satu-satu; baris tak cocok meredup; footer jumlah baris; teks menenangkan saat hasil kosong | `SqlTableVisualizer.tsx` |
| Sukses | Confetti 110 partikel; SFX sukses; Piko lompat + putar 360°; stiker misi menempel di bezel deck; kartu picker berlabel "Selesai"; autosave | `CyberDeckScreen.successPath` + widget |
| Gagal | SFX gagal; Piko kaget (guncang X_X) + teks reaksi; bintang pusing di grid (bot); bar fokus menyusut dengan spring + berubah warna + teks peringatan ≤30 | `funnyFail` + `FocusBar` |
| **Diam / mati** | `onSuccessWorldEvents` tidak pernah di-emit (F-03); dialog intro/sukses/funnyFail tidak pernah tampil (F-03); fokus mencapai 0: tidak ada apa pun (F-04); tombol petunjuk: tanpa SFX | grep + kode |

## Transkrip simulasi (ringkas; keluaran harness atas sandbox asli)

### Q2 — "Domba yang Tersesat" (SQL)

| Kasus | Input pemula | Lint saat mengetik | Hasil RUN → reaksi |
| --- | --- | --- | --- |
| S0 | Kerangka awal, langsung RUN | `Kolom "___" tidak ditemukan` (tanpa saran) | Throw → teks `syntax_error` generik, **fokus −10** |
| S1 | Solusi benar | bersih | **SUKSES** (3 baris) |
| S2 | Urutan kolom ditukar | bersih | **SUKSES** — diff checker adil terhadap variasi benar |
| M1 | Lupa WHERE | bersih | 12 baris → teks ayam balai desa — **pas & lucu** |
| M2 | `status = 'lost'` (huruf kecil) | bersih | 0 baris → teks "data hantu" + suruh cek ejaan status — **pas & mendidik** |
| M3 | `status = 'Hilang'` | bersih | Sama seperti M2 — **pas** |
| M4 | Typo `nama_domba` | Tepat + saran `sheep_name` | Throw → teks `syntax_error` generik soal susunan kalimat (**F-07**) |
| M5 | `SELECT *` | bersih | `wrong_column` → teks "kolom tidak pernah ada" (**F-06**) |
| M6 | Hanya `sheep_name` | bersih | Sama seperti M5 (**F-06**) |
| M7 | `LIMIT 3` tanpa WHERE | bersih | 3 baris salah isi → fallback teks ayam "SEMUA hewan" (**F-05**) |
| M8 | Typo tabel `livestock_log` | Tepat + saran `livestock_logs` | Throw → teks generik (**F-07**) |
| M9 | `status = 'HOME'` | bersih | 4 baris → teks ayam — cukup pas ("tanpa saringan **yang pas**") |

### Q1 — "Bangun, Piko!" (Bot Script)

| Kasus | Input pemula | Lint | Hasil RUN → reaksi |
| --- | --- | --- | --- |
| S0 | Kerangka awal, langsung RUN | 2 error `piko.___` + daftar modul (tercemar `gate.*`, F-10) | boot jalan → FriendlyError baris 10, **fokus −10** (F-09) |
| S1 | Solusi benar | bersih | **SUKSES** — langkah per baris sinkron |
| M1 | `moveForward(5)` + charge | bersih | Berhenti bersih di (5,2), charge gelap → teks **tabrak kayu bakar** (F-02) |
| M2 | `moveForward(9)` + charge | bersih | Tabrak rintangan (7,2) sungguhan → teks tabrakan — **pas** |
| M3 | Lupa `charge()` | bersih | `no_charge` → teks Piko mematung di cahaya — **pas & lucu** |
| M4 | Urutan terbalik, `boot()` terakhir | bersih | **SUKSES** — pelajaran urutan terakali (F-01) |
| M5 | `charge()` dulu di pojok gelap | bersih | Teks **tabrak kayu bakar** (F-02) |
| M6 | `moveForward(2)` (kurang 1) + charge | bersih | Teks **tabrak kayu bakar** (F-02) |
| M7 | `piko.fly()` | Tepat: "belum punya modul" | FriendlyError ramah saat RUN — bagus, tapi tetap **fokus −10** |
| M8 | Typo `moveFoward` | Tepat + saran `moveForward` | FriendlyError tanpa saran di gelembung RUN (F-07) |
| M9 | Tanpa `boot()` sama sekali | bersih | `wrong_order` → teks "tek… tek…" — pas; tetapi di layar Piko sempat berjalan & charge menyala sambil tertidur (F-12b) |

## Analisis tambahan yang diminta

**Kesiapan Q3.** Fondasi teknisnya siap: `gate.open`/`gate.close` sudah di `BASE_BOT_FUNCTIONS`, `MockBot` membawa `gate` + `sensor.soilMoisture`, interpreter mendukung percabangan, dan snippet `if` sudah ada di katalog cartridge. Yang perlu dijaga: perbaikan F-01/F-12 akan mengubah semantik yang diasumsikan Q3 (membaca sensor sebelum boot?), jadi perbaiki sekarang sebelum konten Q3 ditulis di atas semantik yang bocor.

**Sistem fokus −10: adil?** Besarannya sendiri tidak kejam (10 kegagalan untuk menghabiskan bar), dan bar-nya tidak mengunci apa pun. Ketidakadilannya ada di tiga tempat: dikenakan juga saat game sudah tahu kode akan gagal (blank/lint), dikenakan untuk error yang bukan kesalahan konsep (typo satu huruf), dan tidak pernah kembali. Rekomendasi arah ada di Fix #4.

**Piko sebagai guru.** Dua Piko yang berbeda kualitasnya hidup di game ini: Piko-linter (spesifik, menyebut baris, menawarkan tebakan perbaikan, mendaftar modul yang dimiliki — guru yang sangat baik) dan Piko-narator-RUN (kadang berbohong tentang penyebab, F-02/F-05/F-06; kadang lebih bodoh dari linter-nya sendiri, F-07). Meratakan kualitas narator ke level linter adalah tema dari separuh daftar perbaikan di bawah. Hint sendiri terstruktur benar: level 1 = prinsip, level 2 = peta/nilai konkret, level 3 = solusi utuh — untuk kedua quest, di data `hints` maupun versi dialog (yang sayangnya yatim, F-03).

## Top 5 perbaikan (peringkat dampak-kesenangan per usaha)

1. **Tegakkan urutan boot di dunia bot** (F-01) — `BotGridStage`: abaikan/bintik-gagalkan `move`/`charge` saat `!awake` (Piko mengigau di tempat), atau verdict mensyaratkan `boot` mendahului aksi lain. Kecil, bedah, dan mengembalikan pelajaran inti quest pertama. → gameplay-engineer
2. **Pisahkan "charge di tempat gelap" dari "tabrakan"** (F-02) — ganti `flashDizzy()` pada charge-di-luar-target dengan sinyalnya sendiri (goyang lesu + label "tidak ada cahaya di sini"), tambah kunci reaksi `not_on_target`, dan urutkan ulang rantai verdict (posisi dulu, tabrakan dari event tabrakan sungguhan). Sekaligus memperbaiki 3 dari 9 narasi bot. → gameplay-engineer + game-designer (teks)
3. **Hidupkan naskah dialog yang sudah ditulis** (F-03) — putar dialog intro saat quest dibuka, dialog sukses saat tuntas (Pak Rani menyebut nama dombanya!), baris funnyFail setelah reaksi; emit `onSuccessWorldEvents` minimal ke widget/stage yang ada. Kontennya sudah jadi — ini murni plumbing, dan merupakan suntikan "hati" terbesar per baris kode. → gameplay-engineer
4. **Buat fokus memaafkan** (F-04 + F-09) — jangan potong fokus bila kode masih mengandung blank templat atau error yang sudah diketahui linter; pulihkan fokus ke penuh setiap quest tuntas (atau tombol "Istirahat" sungguhan dengan dialog Piko). Rasa brain-fog tetap ada, ratchet permanennya hilang. → game-balance-designer + gameplay-engineer
5. **Perbaiki dua narasi SQL yang menyesatkan** (F-05 + F-06) — tambah reaksi `wrong_result` untuk Q2 ("barisnya pas tiga, tapi isinya bukan domba yang hilang…") dan tulis ulang/bedakan teks `wrong_column` untuk kebanyakan-vs-kekurangan kolom. Hampir nol risiko kode; menghilangkan dua kebohongan pedagogis paling sering. → game-designer (konten)

---
*Evaluator: game-playtest-evaluator (sesi simulasi terprogram + audit kode; tanpa render browser — lihat batas metode di atas). Tidak ada kode yang diubah dalam evaluasi ini.*
