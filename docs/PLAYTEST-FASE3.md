# Playtest — Bit-Terra Fase 3 lengkap (8 quest + desa) — 2026-10-22 (Ronde 2)

**Baseline:** commit `2fc66c3`, 311/311 tes hijau, build hijau. Perubahan selama evaluasi ini: perbaikan ekonomi fokus (lihat `docs/BALANCE-FOKUS-2026-10-22.md`) + satu perbaikan teks reaksi Q6 (PT2-F1) — keduanya dicatat di bawah.
**Verdict keseluruhan: SHIP-SLICE** — kedelapan quest bisa dimainkan ujung-ke-ujung lewat mesin sungguhan, setiap kegagalan pemula yang disimulasikan (53 kasus) mendapat reaksi yang lucu DAN menyebut penyebab yang benar (pengecualian dua catatan LOW), pajak fokus persis mengikuti kebijakan memaafkan, dan tiga cacat HIGH ronde 1 terverifikasi tertutup oleh regresi. Sisa temuan bersifat LOW/desain — tidak ada yang menghalangi rilis slice ini.

## Metode & batas lingkungan (jujur)

Sama seperti ronde 1: tidak ada render browser sungguhan (headless tidak menjangkau localhost), jadi tidak ada screenshot/playthrough visual. Evaluasi lewat:

1. **Kode** jalur pemain di `src/ui/**`, `src/content/**`, `src/world/**`, `src/core/**` dibaca untuk quest & sistem baru.
2. **Simulasi sesi pertama terprogram**: harness vitest sementara (dihapus setelah dipakai) menjalankan **mesin asli** — SqliteWasmRunner + SqlAstLinter + ResultDiffChecker + executeGuardedSql + assessFinalTableState untuk SQL; StepInterpreter + reducer botStageLogic (runBotHeadless/runBotScenariosHeadless) untuk bot — lalu menerapkan **logika verdict yang sama persis** dengan `CyberDeckScreen.tsx` (gerbang linter → snapshot `shouldDeductFocusOnFail` → pemilihan kunci reaksi finalizeSql/runBot, termasuk didahulukannya `failReactionKey` skenario di Q3). 53 kasus: 8 solusi rujukan + 45 kesalahan pemula paling mungkin. Transkrip penuh di §4.
3. **Regresi ronde 1**: kasus F-01, F-02, F-05, F-12a dijalankan ulang sebagai kasus bernama dalam baterai yang sama.
4. **Simulasi ekonomi** 1000 sesi × 4 profil untuk sistem fokus — laporannya terpisah di `docs/BALANCE-FOKUS-2026-10-22.md`.

Angka "waktu" adalah hitungan aksi/edit + konstanta jeda animasi dari kode, bukan stopwatch. Rasa visual dunia Phaser (Fase 2) dan animasi panggung tetap tidak terverifikasi di sini.

## Verdict per heuristik

| Heuristik | Verdict | Ringkasan bukti |
| --- | --- | --- |
| Kejelasan tujuan | **PASS** | Setiap quest: objectiveText eksplisit di deck + komentar kerangka menyebut target/koordinat; di dunia, `getObjectiveHint` menamai pemberi quest berikutnya + lokasinya untuk setiap anak rantai progresi. |
| Waktu-menuju-sukses-pertama | **PASS** | Q1 = 2 blanko + RUN; Q3 (mekanik baru pertama) = 2 blanko callee + RUN — estimasi pembaca pertama ±1–2 menit termasuk membaca (lihat §3). |
| Feedback juice | **PASS WITH NOTES** | Narasi uji-ulang skenario Q3, dialog transisi fase Q8, stiker/confetti warisan Fase 1 semua hidup. Catatan: 5 dari 8 reaksi tertulis Q3 tidak terjangkau jalur skenario (PT2-F3) — variasi narasi lebih tipis dari yang terlihat di data. |
| Rampa kesulitan Q1→Q8 | **PASS WITH NOTES** | Konsep menanjak rapi (urutan → WHERE → if/else → ORDER BY → loop → JOIN → loop bersarang → UPDATE). Satu gundukan: koreografi Q5 (PT2-F7). |
| Keadaan gagal (lucu + mendidik?) | **PASS** | 45/45 kesalahan menghasilkan reaksi yang ada & akurat penyebabnya, kecuali dua catatan LOW (PT2-F3, PT2-F5). Bandingkan ronde 1: 5 dari 19 salah sebut penyebab. |
| Sistem Fokus vs "tanpa takut salah" | **PASS** | Ronde 1 FAIL di sini. Sekarang: pajak hanya untuk kesalahan konsep yang sudah diperingatkan-bersih (transkrip: semua kasus gerbang-linter/runtime/rollback gratis), +20 penyelesaian pertama, petunjuk gratis — dan perbaikan ronde ini menambah **istirahat desa** (simulasi: fokus mulai quest tidak pernah di bawah 50 sesudahnya). |
| Kunci progres (baru) | **PASS** | Tiga permukaan menyebut penghalang yang persis sama: kartu picker ("Terkunci — selesaikan dulu: {judul}"), klik kartu terkunci → Piko menyebut quest penghalang, anchor dunia terkunci → dialog Kabut Otak menyebut judul yang sama, dan petunjuk tujuan HUD selalu menunjuk anak rantai berikutnya. Penguji buta bisa menjawab "kenapa terkunci" dan "apa berikutnya" dari teks terkirim saja. |
| Quest HYBRID Q8 (baru) | **PASS WITH NOTES** | Lencana fase eksplisit ("Fase 1 dari 2 — Perbaiki Data"), kode per fase tersimpan di kunci terpisah, dialog transisi fase hasil karya penulis, verdict fase 1 menilai keadaan akhir tabel (bukan output SELECT). Catatan: progres fase tidak persisten bila deck ditutup di antara fase (PT2-F6). |
| Piko sebagai guru | **PASS** | Linter tetap permukaan mengajar terbaik dan kini dihormati gerbang RUN; petunjuk Q3–Q8 diaudit baris demi baris — semua nama tabel/kolom/nilai yang disebut cocok dengan seed & solusi. |

## Temuan (findings)

### MED

**PT2-F1 — Teks `too_many_rows` Q6 menyalahkan penyebab yang salah untuk 3 dari 4 kasusnya. → DIPERBAIKI di evaluasi ini.**
Pemilihan kunci di `finalizeSql` bersifat hitungan murni: baris berlebih selalu `too_many_rows`, apa pun penyebabnya. Di Q6 empat kesalahan berbeda mendarat di kunci itu: tanpa filter kategori (5 baris), tanpa filter jumlah (4 baris), `>=` di jebakan Rudi (4 baris), JOIN kartesian tanpa ON (banyak baris). Teks lamanya — *"Ini semua setoran dari semua kategori"* — hanya benar untuk kasus pertama; untuk jebakan `>=` (yang justru diperingatkan eksplisit oleh petunjuk 2) narasi mengajari model mental yang salah, kelas cacat yang sama dengan F-05/F-06 ronde 1. **Perbaikan:** teks ditulis ulang agar menutupi semua penyebab dengan jujur ("Ada saringanmu yang bocor: periksa lagi kategorinya, lalu batas jumlahnya. Dan ingat — 'di atas 150.000' tidak memasukkan setoran yang pas 150.000."). *(Pemilik awal: game-designer; selesai di sini.)*

**PT2-F6 — Progres fase Q8 hilang bila deck ditutup di antara fase. → DITANDAI untuk induk (desain).**
`CyberDeckScreen` menginisialisasi `hybridPhase` ke 1 setiap deck quest dibuka, dan mesin SQL di-seed ulang dari nol — pemain yang menuntaskan fase 1, menutup deck untuk berkeliling desa, lalu kembali ke Q8 harus mengulang fase 1 (kode fase 1 & 2 untungnya persisten per kunci, jadi pengulangannya cepat, tetapi tetap gesekan yang tidak dikomunikasikan ke pemain). Perbaikan yang disarankan: persistenkan fase per quest di store (di samping `codeByQuest`) dan lewati fase 1 saat dibuka kembali. Tidak dikerjakan di sini karena mengubah bentuk persistensi adalah keputusan desain, bukan cacat konten. *(Pemilik: gameplay-engineer + game-designer.)*

### LOW

**PT2-F3 — Di jalur skenario Q3, kunci skenario menelan penyebab yang lebih presisi; 5 reaksi tertulis tidak terjangkau.**
`runBot` mendahulukan `scenario.failReactionKey` di atas `botScenarioFailKey(pose)`. Akibatnya skrip tanpa `boot()` sama sekali dinarasikan `gate_still_closed` ("cabang mana yang seharusnya diisi perintah membuka?") padahal penyebabnya Piko tidak pernah dinyalakan — `botScenarioFailKey` sendiri tahu itu `wrong_order`, tetapi tidak pernah dipanggil untuk Q3. Reaksi `wrong_order`, `hit_obstacle`, `out_of_bounds`, `no_charge`, `not_on_target` di data Q3 praktis mati di mode skenario; yang hidup hanya dua kunci skenario + override `interpreter_error`. Dua kunci yang hidup adalah yang paling sentral secara pedagogis, jadi dampaknya kecil — tetapi bila induk ingin memperbaikinya: di `runBot`, dahulukan `botScenarioFailKey` untuk keadaan tertidur/tabrak sebelum jatuh ke kunci skenario. *(Pemilik: gameplay-engineer.)*

**PT2-F4 — Verdict Q3 hanya menilai keadaan pintu; posisi Piko dan nilai batas sensor tidak dinilai.**
`botScenarios.expected` Q3 hanya `{gateOpen}` — skrip yang menerapkan aturan if/else tanpa pernah berjalan ke landasan tetap SUKSES (terverifikasi di transkrip: "aturan tanpa berjalan"). Juga, ambang `<= 40` ikut lulus kedua skenario karena bacaan sensor yang diuji hanya 25 dan 85; nilai batas 40 sendiri tidak pernah diuji. Keduanya bisa dibela (yang diajarkan memang percabangan, dan aturan desa memperlakukan 40 sebagai basah — `<=` melanggarnya secara harfiah), tetapi bila induk menginginkan ketegasan: tambahkan `onTarget: true` ke expected kedua skenario, dan/atau skenario ketiga berbacaan tepat 40. *(Pemilik: game-designer.)*

**PT2-F5 — UPDATE bernilai salah di Q8 terklasifikasi `innocent_changed`.**
`SET status = 'SYNC'` (bukan 'SYNCED') menghasilkan: tidak ada CORRUPT tersisa, jumlah baris sama, isi berbeda → `assessFinalTableState` menjawab `innocent_changed`, yang teksnya bercerita tentang baris SEHAT yang ikut berubah — padahal di sini baris rusaklah yang diperbaiki dengan nilai yang keliru. Taksonomi tiga kunci penilai memang tidak punya kunci "nilai perbaikan salah"; teks `wrong_result` Q8 sebenarnya memuat daftar periksa yang tepat. Catatan saja — memperbaikinya berarti menambah cabang taksonomi di penilai. *(Pemilik: gameplay-engineer.)*

**PT2-F7 — Solusi rujukan Q5 ±24 pernyataan: koreografi ganti lajur mendominasi pelajaran loop-nya.**
Diukur dari `botQuests.test.ts`: pola yang diajarkan (fungsi `dorongSampaiRak` ber-loop) hanya ±5 baris; sisanya ±19 baris navigasi manual (belok dua kali, jalan 6 petak, belok, …) yang diulang untuk lajur kedua dan ketiga — dan itu terjadi di quest berlabel MEDIUM, sebelum Q7 yang HARD justru lebih ringkas (±11 baris). Petunjuk 2–3 memandu koreografinya dengan jujur, jadi ini bukan tembok — tetapi Q5 adalah titik paling mungkin di mana anak lelah mengetik sebelum konsepnya mendarat. Opsi untuk induk: terima sebagai tantangan eksekusi, atau ringankan (mis. fungsi pembantu penavigasi lajur sebagai cartridge). Tidak diubah di sini. *(Pemilik: game-designer + game-balance-designer.)*

### Catatan (bukan temuan)

- **Loop tak hingga dikenai −10** (Q1, transkrip): kode teredit + linter bersih → pajak berlaku untuk `interpreter_error` LoopGuard. Dinilai adil: ini kesalahan konsep sungguhan, pesan FriendlyError-nya ramah dan menyebut obatnya, dan kebijakan memaafkan tidak pernah menjanjikan error runtime bot gratis (yang gratis: runtime SQL, rollback, watchdog — semuanya kelas "bukan salahmu"). Konsisten dengan F-04 sebagaimana diperbaiki.
- **Gesekan dunia↔deck selain PT2-F6 bersih**: deck menutup → pemain kembali ke desa pada posisi yang sama (instance dunia tetap hidup), membuka deck menjeda dunia (`codingMode` → WORLD_PAUSE), dan mengunci quest tidak bisa dilewati dari jalur mana pun (kartu maupun anchor — keduanya melewati penjaga progresi yang sama).

## Waktu-menuju-sukses-pertama Q3 (mekanik baru pertama)

Dari konstanta kode + hitungan aksi (metode ronde 1): kerangka Q3 tiba dengan kondisi if dan struktur dua cabang sudah tertulis; pemain mengisi **2 blanko callee** (`gate.open()` / `gate.close()` — tersedia juga sebagai cartridge) lalu menarik RUN. Satu RUN = dua babak skenario; per babak ±420 ms jeda awal + 3 panggilan bot × 430 ms + event cabang ±80 ms ≈ 1,9 dtk, ditambah jeda antar-skenario dan penyelesaian ±0,7 dtk → **±4,5–5 dtk menonton per RUN**. Estimasi pembaca pertama: baca tujuan + komentar kerangka (±30–60 dtk) + 2 edit + 1 RUN ≈ **1–2 menit** menuju sukses pertama — selevel Q1/Q2, sehat untuk quest yang memperkenalkan percabangan.

## Transkrip simulasi (keluaran harness atas mesin asli; pajak fokus = kebijakan terkirim)

| Quest | Kasus | Hasil | Kunci reaksi | Fokus |
| --- | --- | --- | --- | --- |
| Bangun, Piko! | SOLUSI | SUKSES | — | gratis |
| Bangun, Piko! | boot ditulis terakhir (F-01) | GAGAL | wrong_order | −10 |
| Bangun, Piko! | charge di petak gelap (F-02) | GAGAL | not_on_target | −10 |
| Bangun, Piko! | moveForward(0) sah (F-12a) | SUKSES | — | gratis |
| Bangun, Piko! | kerangka mentah langsung RUN | DITOLAK LINTER | — | gratis |
| Bangun, Piko! | typo moveFoward | DITOLAK LINTER | — | gratis |
| Bangun, Piko! | loop tak hingga | GAGAL | interpreter_error | −10 |
| Domba yang Tersesat | SOLUSI | SUKSES | — | gratis |
| Domba yang Tersesat | SELECT * (semua kolom) | GAGAL | wrong_column | −10 |
| Domba yang Tersesat | kurang satu kolom | GAGAL | wrong_column | −10 |
| Domba yang Tersesat | LIMIT 3 tanpa WHERE (F-05) | GAGAL | wrong_result | −10 |
| Domba yang Tersesat | status huruf kecil 'lost' | GAGAL | no_rows | −10 |
| Domba yang Tersesat | typo kolom nama_domba | DITOLAK LINTER | — | gratis |
| Domba yang Tersesat | tanpa WHERE sama sekali | GAGAL | too_many_rows | −10 |
| Pintu Air Kemarau | SOLUSI | SUKSES | — | gratis |
| Pintu Air Kemarau | hardcode gate.open() | GAGAL | opened_when_wet (skenario 2) | −10 |
| Pintu Air Kemarau | cabang tertukar | GAGAL | gate_still_closed (skenario 1) | −10 |
| Pintu Air Kemarau | ambang <= 40 (observasi PT2-F4) | SUKSES | — | gratis |
| Pintu Air Kemarau | aturan tanpa berjalan (observasi PT2-F4) | SUKSES | — | gratis |
| Pintu Air Kemarau | tanpa boot sama sekali | GAGAL | gate_still_closed (PT2-F3) | −10 |
| Teras Sawah | SOLUSI | SUKSES | — | gratis |
| Teras Sawah | ASC (urutan terbalik) | GAGAL | wrong_result | −10 |
| Teras Sawah | tanpa WHERE (jebakan Hujan 88) | GAGAL | wrong_result | −10 |
| Teras Sawah | tanpa LIMIT | GAGAL | too_many_rows | −10 |
| Teras Sawah | SELECT * | GAGAL | wrong_column | −10 |
| Teras Sawah | musim huruf kecil 'kemarau' | GAGAL | no_rows | −10 |
| Teras Sawah | typo kolom berat | DITOLAK LINTER | — | gratis |
| Ban Berjalan Roti | SOLUSI | SUKSES | — | gratis |
| Ban Berjalan Roti | satu lajur saja | GAGAL | boxes_incomplete | −10 |
| Ban Berjalan Roti | loop 3x (kurang satu dorongan) | GAGAL | boxes_incomplete | −10 |
| Ban Berjalan Roti | dorong sampai tepi | GAGAL | box_stuck | −10 |
| Ban Berjalan Roti | belok salah arah | GAGAL | out_of_bounds | −10 |
| Festival Panen Raya | SOLUSI | SUKSES | — | gratis |
| Festival Panen Raya | batas >= 150000 (jebakan Rudi) | GAGAL | too_many_rows (teks diperbaiki, PT2-F1) | −10 |
| Festival Panen Raya | tanpa filter kategori | GAGAL | too_many_rows | −10 |
| Festival Panen Raya | tanpa filter jumlah | GAGAL | too_many_rows | −10 |
| Festival Panen Raya | JOIN tanpa ON (kartesian) | GAGAL | too_many_rows | −10 |
| Festival Panen Raya | typo tabel kas_festifal | DITOLAK LINTER | — | gratis |
| Labirin Akar | SOLUSI | SUKSES | — | gratis |
| Labirin Akar | satu sisi saja | GAGAL | plants_dry | −10 |
| Labirin Akar | siram sebelum melangkah | GAGAL | watered_empty | −10 |
| Labirin Akar | loop luar 3 sisi | GAGAL | plants_dry | −10 |
| Labirin Akar | turnLeft di loop luar | GAGAL | hit_obstacle | −10 |
| Magang di OmniCloud | REFERENSI fase 1 (SELECT + UPDATE) | SUKSES (fase 1) | — | gratis |
| Magang di OmniCloud | UPDATE menyeluruh tanpa WHERE | GAGAL | innocent_changed | −10 |
| Magang di OmniCloud | perbaikan sebagian (satu zona) | GAGAL | still_corrupt | −10 |
| Magang di OmniCloud | DELETE baris rusak | GAGAL | innocent_changed | −10 |
| Magang di OmniCloud | SELECT saja, tidak memperbaiki | GAGAL | still_corrupt | −10 |
| Magang di OmniCloud | nilai salah 'SYNC' (PT2-F5) | GAGAL | innocent_changed | −10 |
| Magang di OmniCloud | typo nama tabel | DITOLAK LINTER | — | gratis |
| Magang di OmniCloud | SOLUSI fase 2 | SUKSES | — | gratis |
| Magang di OmniCloud | kurang satu langkah | GAGAL | not_on_target | −10 |
| Magang di OmniCloud | lupa charge | GAGAL | no_charge | −10 |
| Magang di OmniCloud | tanpa boot | GAGAL | wrong_order | −10 |

## Top perbaikan menurut dampak (untuk induk)

1. **PT2-F6** — persistenkan fase HYBRID per quest; gesekan nyata satu-satunya di loop dunia↔deck. → gameplay-engineer
2. **PT2-F3** — dahulukan kunci pose (tertidur/tabrak) di atas kunci skenario di `runBot`; menghidupkan kembali 5 reaksi tertulis Q3. → gameplay-engineer
3. **PT2-F7** — pertimbangkan meringankan koreografi Q5. → game-designer
4. **PT2-F4 / PT2-F5** — ketegasan verdict Q3 & taksonomi nilai-salah Q8; kecil, opsional. → game-designer / gameplay-engineer

---
*Evaluator: game-playtest-evaluator ronde 2 (simulasi terprogram + audit kode; tanpa render browser — lihat batas metode). Kode yang diubah dalam evaluasi ini: teks reaksi `too_many_rows` Q6 (PT2-F1) dan perbaikan ekonomi fokus (dokumen balance terpisah). Harness simulasi dihapus setelah dipakai, mengikuti pola ronde 1.*
