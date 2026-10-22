# Bit-Terra: The Great Rollback — Brief Cerita & Desain (ringkasan setia dari brief user 2026-10-22)

Prinsip inti: game edukasi jadi seru saat pemain LUPA sedang belajar. Tiga kunci:
(1) cerita yang punya hati, (2) umpan balik visual/audio yang juicy, (3) kebebasan
bereksperimen tanpa takut salah. Full text: chat 2026-10-22 (dua pesan brief).

## Premis
Pemain = mantan programmer kota yang burnout, mewarisi bengkel kakek (insinyur
legendaris) di Desa Bit-Terra, desa solarpunk tempat alam + teknologi ramah
lingkungan berdampingan. Sepuluh tahun lalu "The Great Rollback": The Mother-Tree
(pohon raksasa yang akarnya menyatu jaringan optik dan menyimpan memori + otomasi
desa) kehilangan sebagian datanya. Robot penyiram linglung, kincir & pintu air tak
sinkron cuaca, catatan desa teracak dalam kristal memori. OmniCloud Corp (antagonis
korporat ala JojaMart) membujuk Kepala Desa: cloud berbayar dengan syarat hak
kelola lahan warga.

## Tiga babak
- Act 1 `localhost` (Semi): perbaiki bengkel, aktifkan robot pendamping Piko,
  bantu masalah sederhana warga → kepercayaan pada teknologi lokal (Open-Source Village).
- Act 2 `INNER JOIN` (Panas/Gugur): tambang kristal data, perpustakaan tua,
  stasiun kereta uap-surya; masalah antarwarga terhubung; rahasia kakek + penyebab Rollback.
- Act 3 `COMMIT` (Dingin): OmniCloud sabotase saat festival akhir tahun; warga +
  pemain perbaiki Root Database lewat final puzzle logika + SQL.

## Filosofi "Code is Fun"
- Cartridge & Stiker Sintaks: perintah (WHERE, ORDER BY, JOIN, while) = item RPG
  yang ditemukan di dunia (mancing, hadiah NPC, prasasti tambang) berbentuk
  Floppy Disk / Cartridge warna-warni. Tidak semua sintaks tersedia sejak awal.
- Eksekusi Live Step-by-Step: tarik tuas RUN → dunia pixel bergerak mengikuti
  baris kode satu per satu; baris aktif menyala selaras gerakan robot.
- Gagal Itu Lucu: TIDAK ADA layar "ERROR: WRONG ANSWER". Salah WHERE undangan →
  semua ayam berkumpul di balai desa. Loop roti tak berhenti → roti menghujani
  desa dari cerobong. Pemain sengaja salah demi animasi konyol = fitur.

## Imersi
- Visual "HD-2D Solarpunk": palet hangat (hijau segar, kuning matahari, kayu,
  tembaga/kuningan); area terminal/bawah tanah kontras neon cyan + amber.
  God rays, bayangan awan bergerak, bloom lembut pada layar robot & lampu malam.
- Diegetic UI: Cyber-Deck fisik milik kakek — stiker hadiah quest di bezel,
  gantungan kunci pixel bergoyang saat mengetik, tuas mekanik besar untuk RUN.
- Audio adaptif: overworld = Acoustic Lo-Fi / Cozy Folk; buka Cyber-Deck →
  layer Lo-Fi Hip-Hop + Chiptune 8-bit MENUMPUK di atas lagu yang sama (bukan
  ganti lagu). ASMR mengetik mechanical keyboard (variasi pitch), tuas EXECUTE
  berbunyi Clank—Whirrrr—Ding!, jingle per baris data berhasil.
- Waktu dunia PAUSE saat Cyber-Deck dibuka. "Brain Fog / Focus Bar" menggantikan
  stamina: error saat Run mengurangi Focus; habis → Piko sarankan kopi di Kafe
  Byte & Bean / memancing / tidur.

## Karakter (canvas 32x32 / 24x32 chibi-tall; portrait 64x64, 4 ekspresi)
- Rayan/Raya (player, The Fixer): overall denim, hoodie mustard, goggles tembaga.
- Piko (maskot + linter hidup): robot bulat seukuran kucing, wajah layar CRT
  hijau (ekspresi ^ ^, o_O, X_X), antena daun. Animasi: Follow_Bounce, Scan_Laser,
  Confused_Tilt (error), Happy_Spin (sukses).
- Pak Tua Query: guru SQL, arsiparis. Cici Loops: mekanik, guru logic/loop.
  Bibi Flora: botani, guru array & grid. Viktor Vance: utusan OmniCloud, antagonis.
- Pipeline sprite: base template (Mana Seed / LPC) + Aseprite/LibreSprite, atau
  AI pixel generator + cleanup; idle 2 frame, walk 4 frame/arah; export sprite
  sheet JSON (hash/array) untuk Phaser `this.load.aseprite()`.

## Wilayah
Grandpa's Workshop & Farm (awal) · Town Square & Mother-Tree (Great Ledger) ·
Data Archives (perpustakaan) · Rust-Belt Dock & Hydro-Dam (sungai, mancing
cartridge) · Crystal Cavern (tambang; Bug Monsters: Syntax Gremlins, Deadlock Golems).

## Quest utama (detail penuh di BLUEPRINT.md §6)
Q1 Bangun, Piko! (Bot, Easy) · Q2 Domba yang Tersesat (SQL SELECT/WHERE, Easy) ·
Q3 Pintu Air Kemarau (Bot if/else, Easy) · Q4 Urutan Panen Terbaik (SQL ORDER BY/
LIMIT, Easy-Med) · Q5 Sabuk Konveyor Roti (Bot for/if, Medium) · Q6 Misteri Kas
Festival (SQL JOIN/GROUP BY/HAVING, Medium) · Q7 Jembatan Kristal Putus (Bot
function/nested loop, Hard) · Q8 The Great Commit (Hybrid SQL UPDATE+COMMIT +
code, Hard, final).
