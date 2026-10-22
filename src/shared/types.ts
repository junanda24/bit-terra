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
  };
  hints: [string, string, string];
  onSuccessWorldEvents: string[];
  onFailFunnyReactions: Record<string, string>;
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
