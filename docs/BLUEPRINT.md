# Bit-Terra — Master Blueprint (TDD & GDD, ringkasan setia dari dokumen user 2026-10-22)

Full text: chat 2026-10-22. Dokumen ini = kontrak kerja semua agent. Story: `docs/BRIEF-STORY.md`.

## 1. Stack (Hybrid Canvas + DOM)
- React 19 + TS + Vite (UI/DOM) · Phaser 3 WebGL (dunia; mulai Fase 2) ·
  Zustand + mitt EventBus (bridge UI↔engine) · CodeMirror 6 (editor) ·
  SQL.js / SQLite WASM (SQL asli di RAM browser) · node-sql-parser (linter AST) ·
  Acorn + custom StepInterpreter (eksekusi kode baris-per-baris, ZERO eval) ·
  Framer Motion + canvas-confetti (juice UI) · Howler.js + Web Audio (audio
  adaptif + SFX) · Dexie.js IndexedDB + export/import `.bitterra` (save).
- 100% client-side. NO backend, NO auth.

## 2. Struktur folder (feature/domain-driven)
```
src/
  core/bridge/        EventBus (mitt) + Zustand store
  core/persistence/   Dexie schema, autosave, export/import
  core/audio/         SoundController (Howler) + WebAudio synth + adaptive mixer
  engine/             PHASER (Fase 2+) — pure TS, ZERO import React
  sandbox/sql/        SqliteWasmRunner, SqlAstLinter, ResultDiffChecker
  sandbox/script/     AstParser, StepInterpreter, BotApiBindings, LoopGuard, FriendlyErrorTranslator
  ui/cyberdeck/       CyberDeckFrame, InteractiveEditor, TypingParticleCanvas
  ui/visualizer/      SqlTableVisualizer, AstStepHighlighter, PikoMascotWidget
  ui/hud/             FocusBar, CartridgeInventory, DialogueBox
  ui/design-system/   PixelButton, NineSlicePanel, CRTScanlineOverlay
  content/quests/     satu file per quest (QuestDefinition)
  content/schemas/    seed SQL per quest
  content/dialogues/  dialog NPC per quest
```

## 3. Code rules (MUTLAK)
1. 3-Layer Isolation: `engine/` dilarang import `ui/`; `ui/` dilarang mutasi
   objek Phaser langsung. Semua komunikasi via EventBus (aksi) / Zustand (state).
2. Data-Driven Quest: dilarang `if (questId === ...)` hardcoded. Semua quest
   patuh `QuestDefinition`. Quest baru = file config baru di `content/quests/`.
3. Zero `eval()` / `new Function()`. Eksekusi pemain hanya via StepInterpreter
   AST; LoopGuard maksimum 500 ticks agar tab tak pernah freeze.
4. Pixel-Perfect: `image-rendering: pixelated`, Phaser `pixelArt: true,
   roundPixels: true`, skala UI kelipatan bulat (2x/3x/4x).

## 4. Design system "Tactile Solarpunk & Amber CRT"
- World palette: moss `#4b724f`, sun `#f4b41b`, terracotta wood `#a85432`,
  river `#3b82a6`, copper `#c87d55` (palet 64 warna hangat).
- Cyber-Deck palette: dark slate `#141820`, bezel krem retro `#d8ccb8`,
  phosphor amber `#ffb000`, mint cyan `#00f5d4` (keyword SQL), coral `#ff4d6d` (error).
- Font: Pixelify Sans (dialog/HUD) + Press Start 2P (judul) + JetBrains Mono (kode/tabel).
- Panel UI: 9-slice border (tembaga/kayu/kaset retro, baut 4 sudut).

## 5. Kontrak bersama (WAJIB dipakai semua modul, jangan bikin versi lain)

### QuestDefinition (verbatim blueprint §6)
```typescript
export interface QuestDefinition {
  id: string;
  title: string;
  act: 1 | 2 | 3;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  mode: 'SQL' | 'BOT_SCRIPT' | 'HYBRID';
  giverNpcId: string;
  storyContext: string;
  objectiveText: string;
  unlockedCartridges: string[];
  initialCode: string;
  sqlSeedScript?: string;
  expectedSqlResult?: Record<string, any>[];
  botWorldSetup?: { gridSize: [number, number]; obstacles: [number, number][]; targets: [number, number][] };
  hints: [string, string, string];
  onSuccessWorldEvents: string[];
  onFailFunnyReactions: Record<string, string>;
}
```

### EventBus (mitt) — nama event kanonik
`EXECUTE_CODE {questId}` · `BOT_ACTION {action: string, args: unknown[], line: number}` ·
`STEP_HIGHLIGHT {line: number | null}` · `SQL_RESULT {rows, columns}` ·
`LINTER_STATE {errors: LintError[]}` · `QUEST_COMPLETED {questId}` ·
`QUEST_FUNNY_FAIL {questId, reactionKey}` · `WORLD_PAUSE` / `WORLD_RESUME` ·
`FOCUS_CHANGED {focus: number}` · `PIKO_SAY {text, mood}`.
LintError = `{ line: number, column?: number, message: string, suggestion?: string }`
(bahasa Indonesia ramah, gaya Piko — BUKAN stack trace mentah).

### Sandbox API
- `SqliteWasmRunner`: `init(seedScript)`, `runQuery(sql): {columns, rows}`,
  `getSchema(): {table, columns[]}[]`, `dispose()`. SQL.js WASM dimuat dari
  package `sql.js` (wasm file di-serve lokal via Vite `?url` import — bukan CDN).
- `SqlAstLinter.lint(sql, schema): LintError[]` — node-sql-parser AST: cek
  sintaks + nama tabel/kolom terhadap skema aktif + saran "apakah maksudmu X?"
  (jarak edit terdekat).
- `ResultDiffChecker.check(actual, expected, {orderMatters}): {pass, diffs[]}` —
  toleran variasi jawaban benar (alias, urutan kolom, JOIN eksplisit vs implisit
  dinilai dari RESULT SET, bukan teks query).
- `StepInterpreter.run(code, botApi): AsyncGenerator<StepEvent>` —
  StepEvent = `{ line, kind: 'call'|'assign'|'loop'|'branch'|'done', action?, args? }`.
  Acorn parse → interpretasi AST manual. Mendukung: ExpressionStatement (panggilan
  fungsi bot), VariableDeclaration, IfStatement, ForStatement, ForOfStatement,
  WhileStatement (LoopGuard!), FunctionDeclaration + ReturnStatement, literal,
  BinaryExpression, MemberExpression, TemplateLiteral sederhana.
- `BotApiBindings`: registry fungsi yang boleh dipanggil per quest (dari
  `unlockedCartridges`/botWorldSetup) — panggilan di luar registry = LintError
  ramah ("Piko belum punya modul itu").
- `FriendlyErrorTranslator`: semua error sandbox → pesan Indonesia in-character
  Piko + petunjuk baris. TIDAK PERNAH menampilkan stack trace ke pemain.

### Audio
- `SoundController`: `playSFX(name)`, `setCodingMode(on: boolean)` (crossfade
  Track A akustik ↔ Track B chiptune/lofi, fade 1.5s), `playKeystroke()` (klik
  mekanik WebAudio synth, pitch random ±8%, playbackRate 0.95–1.05).
  Fase 1: synth WebAudio murni (tanpa file eksternal) — termasuk lofi generatif
  gaya engine simulator (progresi akor + swing) sebagai placeholder track adaptif.

## 6. Fase 1 (SEDANG DIBANGUN) — Cyber-Deck Sandbox Prototype
Sesuai roadmap blueprint Fase 1 (Phaser masuk Fase 2):
- Cyber-Deck React + CodeMirror 6: mode SQL + mode Bot Script, cartridge bar
  (klik = sisipkan kerangka sintaks + efek snap), lampu READY (amber→hijau saat
  linter bersih), tuas RUN fisik.
- Typing juice: partikel pixel di koordinat kursor (canvas overlay
  pointer-events-none, 3–5 partikel 3x3px, 300ms), suara ketik mekanik, combo
  keystroke streak.
- Linter real-time (debounce 150ms) + Piko widget (ekspresi: normal/senang/
  bingung/kaget; balon teks hint/error ramah).
- Eksekusi: SQL → Data Scanner visual (baris tabel di-scan, cocok = hijau
  terbang ke tabel hasil); Bot → split view: editor 35% + stage grid 65%
  (visualizer grid DOM/canvas sederhana; Fase 2 diganti Phaser) — robot bergerak
  per StepEvent, baris aktif ter-highlight sinkron.
- Konten playable: Q1 "Bangun, Piko!" (BOT_SCRIPT) + Q2 "Domba yang Tersesat"
  (SQL) lengkap dengan dialog, 3 level hint, fail reactions lucu.
- Focus bar: error saat Run mengurangi Focus; habis → Piko sarankan istirahat
  (dialog saja di Fase 1).
- Persistence: Dexie autosave progres quest + kode pemain (envelope berversi).
- Boot loading overlay eksplisit (tidak pernah layar kosong).

## 7. Self-healing (WAJIB di pass akhir — perintah user)
RecoveryBoundary (app + editor), autosave envelope `{version, savedAt, payload}`
+ migrasi + karantina data korup, error log lokal, DiagnosticsPanel (cek WASM
SQL, IndexedDB, audio context, interpreter smoke test), pesan jujur saat WASM
gagal dimuat + mode degradasi (editor tetap bisa dibuka), watchdog linter.
Model: pass SH simulator elektronika (terbukti) diadaptasi ke game ini.

## 8. Roadmap lanjutan (blueprint)
Fase 2: Phaser + bridge + peta Workshop & Farm (Tiled) + CommandQueueRunner.
Fase 3: audio adaptif penuh + Dexie polish + Q3–Q8. Fase 4: shader lighting/CRT,
balancing (game-balance-designer), playtest (game-playtest-evaluator).
