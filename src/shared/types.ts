// Bit-Terra — shared contracts (docs/BLUEPRINT.md §5). Every module imports
// types from here; no module defines its own copy of these shapes.

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
  expectedSqlResult?: Record<string, unknown>[];
  /**
   * Quest ini MENGAJARKAN urutan baris (Fase 3 Q4: ORDER BY) — verdict SQL
   * membandingkan hasil per posisi, bukan sebagai himpunan. Default
   * (undefined/false): urutan bebas, dan ORDER BY sukarela dari pemain
   * tidak pernah menggagalkan jawaban yang isinya benar.
   */
  sqlOrderMatters?: boolean;
  /**
   * Quest SQL bertulis (Fase 3 Q8, mode HYBRID fase 1): verdict BUKAN pada
   * output SELECT pemain, melainkan pada KEADAAN AKHIR tabel sqlSourceTable
   * sesudah perbaikannya — daftar ini = isi tabel yang diharapkan persis
   * (semua kolom, semua baris). Hanya bermakna bersama sqlWritesAllowed.
   */
  expectedFinalTableState?: Record<string, unknown>[];
  /** Kode awal fase Bot untuk quest HYBRID (fase 1 memakai initialCode). */
  hybridBotInitialCode?: string;
  /** Cartridge yang tampil di fase Bot quest HYBRID (fase 1 memakai unlockedCartridges). */
  hybridBotCartridges?: string[];
  /** Label indikator fase HYBRID: [label fase SQL, label fase Bot]. */
  hybridPhaseLabels?: [string, string];
  /**
   * Quest SQL ini mengizinkan statement tulis (UPDATE/INSERT/DELETE/DDL)
   * sebagai bagian sah dari solusi (Fase 3 Q8). Default (undefined/false):
   * quest baca-saja — setiap run dibungkus snapshot + auto-rollback,
   * dan run yang terkontaminasi statement tulis tidak pernah bisa
   * menyelesaikan quest (audit SQL-H1).
   */
  sqlWritesAllowed?: boolean;
  /**
   * Tabel yang ditampilkan scanner sebagai "isi database saat ini"
   * (audit SQL-M2). Default: tabel pertama dari skema aktif.
   */
  sqlSourceTable?: string;
  botWorldSetup?: {
    gridSize: [number, number];
    obstacles: [number, number][];
    targets: [number, number][];
    /** Posisi awal robot [x, y]. Default konvensi lama: [0, 2]. */
    startPos?: [number, number];
    /** Arah hadap awal robot: 0 timur, 1 selatan, 2 barat, 3 utara. Default 0. */
    startFacing?: 0 | 1 | 2 | 3;
    /**
     * Peti yang bisa didorong robot (Fase 3 Q5): melangkah ke petak peti
     * mendorongnya satu petak bila petak sesudahnya bebas. `targets` pada
     * quest berpeti = petak tujuan PETI, bukan robot.
     */
    boxes?: [number, number][];
    /**
     * Tanaman yang bisa disiram `piko.water()` (Fase 3 Q7). Petak tanaman
     * BOLEH diinjak robot; menyiram menargetkan tanaman di petak robot
     * berdiri. Peti tidak bisa didorong masuk ke petak tanaman.
     */
    plants?: [number, number][];
    /** Petak pintu air yang digambar mengikuti status gate (Fase 3 Q3). */
    gateTile?: [number, number];
    /**
     * Gaya gambar petak target di panggung: 'sun' = petak cahaya (Q1),
     * 'platform' = landasan tuas (Q3), 'marker' = tanda tujuan peti (Q5).
     * Default 'sun'.
     */
    targetKind?: 'sun' | 'platform' | 'marker';
  };
  /**
   * Skenario uji berurutan untuk quest bot (Fase 3 Q3): skrip pemain
   * dijalankan ulang dari dunia segar untuk SETIAP skenario (setup sensor
   * berbeda), dan quest hanya tuntas bila semua skenario memenuhi
   * harapannya. Tanpa field ini, quest bot berjalan sekali seperti biasa.
   */
  botScenarios?: BotScenario[];
  hints: [string, string, string];
  onSuccessWorldEvents: string[];
  onFailFunnyReactions: Record<string, string>;
}

/**
 * Harapan keadaan dunia di akhir satu skenario bot — SEMUA field opsional;
 * hanya field yang disebut yang diperiksa (keadaan parsial).
 */
export interface BotScenarioExpectation {
  /** Pintu air berakhir terbuka (true) atau tertutup (false). */
  gateOpen?: boolean;
  /** Robot berakhir di atas petak target. */
  onTarget?: boolean;
  /** Robot berakhir terisi daya di petak target. */
  charged?: boolean;
  /** Semua peti berakhir di petak target (quest berpeti). */
  boxesOnTargets?: boolean;
  /** Semua tanaman berakhir tersiram (quest bertanaman). */
  allPlantsWatered?: boolean;
  /** Robot berakhir tepat di petak ini. */
  position?: [number, number];
}

/** Satu babak uji dalam quest bot berskenario (lihat QuestDefinition.botScenarios). */
export interface BotScenario {
  /** Narasi Piko yang diucapkan SEBELUM skenario ini dijalankan. */
  label: string;
  /** Timpaan keadaan awal dunia untuk skenario ini. */
  setup: {
    /** Nilai sensor.soilMoisture selama skenario ini (0 kering – 100 basah). */
    soilMoisture?: number;
  };
  expected: BotScenarioExpectation;
  /**
   * Kunci reaksi lucu bila skenario ini gagal. Bila kosong, kunci diturunkan
   * dari selisih harapan vs keadaan akhir (botStageLogic.botScenarioFailKey).
   */
  failReactionKey?: string;
}

export interface LintError {
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  /** Kode kategori opsional (mis. 'blank' untuk blanko ___ pada template) —
   * dipakai UI untuk menggabungkan pesan sejenis (audit layout F). */
  code?: string;
}

export type PikoMood = 'normal' | 'happy' | 'confused' | 'shocked';

export interface SqlRunResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface TableSchema {
  table: string;
  columns: string[];
}

export type StepKind = 'call' | 'assign' | 'loop' | 'branch' | 'done';

export interface StepEvent {
  line: number;
  kind: StepKind;
  action?: string;
  args?: unknown[];
}

export interface DiffResult {
  pass: boolean;
  diffs: string[];
}

/** mitt event map — canonical event names from docs/BLUEPRINT.md §5. */
export interface GameEvents {
  EXECUTE_CODE: { questId: string };
  BOT_ACTION: { action: string; args: unknown[]; line: number };
  STEP_HIGHLIGHT: { line: number | null };
  SQL_RESULT: SqlRunResult;
  LINTER_STATE: { errors: LintError[] };
  QUEST_COMPLETED: { questId: string };
  QUEST_FUNNY_FAIL: { questId: string; reactionKey: string };
  WORLD_PAUSE: undefined;
  WORLD_RESUME: undefined;
  /** Fase 2: dunia (Phaser) meminta UI membuka Cyber-Deck untuk quest ini. */
  OPEN_DECK: { questId: string };
  /** Fase 2: satu wilayah desa selesai diperbaiki oleh progres pemain. */
  WORLD_REPAIR: { area: string };
  /** Fase 2: dunia meminta UI menampilkan dialog NPC/papan petunjuk. */
  WORLD_DIALOGUE: { name: string; lines: string[] };
  /** Fase 2: label petunjuk interaksi terdekat (null = tidak ada). */
  WORLD_PROMPT: { text: string | null };
  FOCUS_CHANGED: { focus: number };
  PIKO_SAY: { text: string; mood: PikoMood };
}
