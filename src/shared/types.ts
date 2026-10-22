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
  FOCUS_CHANGED: { focus: number };
  PIKO_SAY: { text: string; mood: PikoMood };
}
