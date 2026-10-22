import { create } from 'zustand';
import type { PikoMood } from '../../shared/types';
import { eventBus } from './eventBus';

export type EditorMode = 'SQL' | 'BOT_SCRIPT';

export interface PikoLine {
  text: string;
  mood: PikoMood;
}

/** Shape persisted by core/persistence (envelope payload). */
export interface PersistedProgress {
  completedQuests: string[];
  codeByQuest: Record<string, string>;
  focus: number;
}

export const FOCUS_MIN = 0;
export const FOCUS_MAX = 100;

export function clampFocus(value: number): number {
  if (!Number.isFinite(value)) return FOCUS_MAX;
  return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(value)));
}

interface GameStore extends PersistedProgress {
  currentQuestId: string | null;
  editorMode: EditorMode;
  /** True while the Cyber-Deck is open; the world is paused meanwhile. */
  codingMode: boolean;
  pikoLine: PikoLine | null;

  setCurrentQuest: (questId: string | null, mode?: EditorMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setCode: (questId: string, code: string) => void;
  setFocus: (focus: number) => void;
  adjustFocus: (delta: number) => void;
  setCodingMode: (on: boolean) => void;
  completeQuest: (questId: string) => void;
  sayPiko: (text: string, mood: PikoMood) => void;
  clearPiko: () => void;
  /** Apply a loaded save payload silently (no bus events — it is a restore, not gameplay). */
  hydrate: (payload: PersistedProgress) => void;
  resetProgress: () => void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  currentQuestId: null,
  editorMode: 'SQL',
  codeByQuest: {},
  focus: FOCUS_MAX,
  codingMode: false,
  completedQuests: [],
  pikoLine: null,

  setCurrentQuest: (questId, mode) =>
    set((s) => ({
      currentQuestId: questId,
      editorMode: mode ?? s.editorMode,
    })),

  setEditorMode: (mode) => set({ editorMode: mode }),

  setCode: (questId, code) =>
    set((s) => ({ codeByQuest: { ...s.codeByQuest, [questId]: code } })),

  setFocus: (focus) => {
    const next = clampFocus(focus);
    if (next === get().focus) return;
    set({ focus: next });
    eventBus.emit('FOCUS_CHANGED', { focus: next });
  },

  adjustFocus: (delta) => get().setFocus(get().focus + delta),

  setCodingMode: (on) => {
    if (on === get().codingMode) return;
    set({ codingMode: on });
    // The world pauses while the player thinks (BLUEPRINT §6 / GDD §4A).
    eventBus.emit(on ? 'WORLD_PAUSE' : 'WORLD_RESUME', undefined);
  },

  completeQuest: (questId) => {
    if (get().completedQuests.includes(questId)) return;
    set((s) => ({ completedQuests: [...s.completedQuests, questId] }));
    eventBus.emit('QUEST_COMPLETED', { questId });
  },

  sayPiko: (text, mood) => {
    set({ pikoLine: { text, mood } });
    eventBus.emit('PIKO_SAY', { text, mood });
  },

  clearPiko: () => set({ pikoLine: null }),

  hydrate: (payload) =>
    set({
      completedQuests: [...payload.completedQuests],
      codeByQuest: { ...payload.codeByQuest },
      focus: clampFocus(payload.focus),
    }),

  resetProgress: () =>
    set({ completedQuests: [], codeByQuest: {}, focus: FOCUS_MAX, pikoLine: null }),
}));

/** Snapshot of exactly the fields the save system persists. */
export function selectPersistedProgress(state: GameStore): PersistedProgress {
  return {
    completedQuests: state.completedQuests,
    codeByQuest: state.codeByQuest,
    focus: state.focus,
  };
}
