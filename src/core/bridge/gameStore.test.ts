import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from './eventBus';
import { clampFocus, useGameStore, type PersistedProgress } from './gameStore';

const initial = {
  currentQuestId: null,
  editorMode: 'SQL' as const,
  codeByQuest: {},
  focus: 100,
  codingMode: false,
  completedQuests: [] as string[],
  pikoLine: null,
};

beforeEach(() => {
  useGameStore.setState(initial);
});

afterEach(() => {
  eventBus.all.clear();
});

describe('gameStore', () => {
  it('setFocus clamps to 0..100 and emits FOCUS_CHANGED only on change', () => {
    const handler = vi.fn();
    eventBus.on('FOCUS_CHANGED', handler);
    useGameStore.getState().setFocus(80);
    expect(useGameStore.getState().focus).toBe(80);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ focus: 80 });
    useGameStore.getState().setFocus(80);
    expect(handler).toHaveBeenCalledTimes(1);
    useGameStore.getState().setFocus(250);
    expect(useGameStore.getState().focus).toBe(100);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith({ focus: 100 });
  });

  it('adjustFocus moves relative to the current value', () => {
    useGameStore.getState().adjustFocus(-15);
    expect(useGameStore.getState().focus).toBe(85);
  });

  it('sayPiko stores the line and emits PIKO_SAY', () => {
    const handler = vi.fn();
    eventBus.on('PIKO_SAY', handler);
    useGameStore.getState().sayPiko('Halo, Bit-Terra!', 'happy');
    expect(useGameStore.getState().pikoLine).toEqual({ text: 'Halo, Bit-Terra!', mood: 'happy' });
    expect(handler).toHaveBeenCalledWith({ text: 'Halo, Bit-Terra!', mood: 'happy' });
    useGameStore.getState().clearPiko();
    expect(useGameStore.getState().pikoLine).toBeNull();
  });

  it('completeQuest records once and emits QUEST_COMPLETED once', () => {
    const handler = vi.fn();
    eventBus.on('QUEST_COMPLETED', handler);
    useGameStore.getState().completeQuest('q1');
    useGameStore.getState().completeQuest('q1');
    expect(useGameStore.getState().completedQuests).toEqual(['q1']);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('setCodingMode emits WORLD_PAUSE / WORLD_RESUME on transitions only', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    eventBus.on('WORLD_PAUSE', pause);
    eventBus.on('WORLD_RESUME', resume);
    useGameStore.getState().setCodingMode(true);
    useGameStore.getState().setCodingMode(true);
    expect(pause).toHaveBeenCalledTimes(1);
    useGameStore.getState().setCodingMode(false);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('setCode keeps code per quest and setCurrentQuest switches mode', () => {
    useGameStore.getState().setCode('q1', 'piko.boot();');
    useGameStore.getState().setCode('q2', 'SELECT 1;');
    expect(useGameStore.getState().codeByQuest).toEqual({
      q1: 'piko.boot();',
      q2: 'SELECT 1;',
    });
    useGameStore.getState().setCurrentQuest('q1', 'BOT_SCRIPT');
    expect(useGameStore.getState().currentQuestId).toBe('q1');
    expect(useGameStore.getState().editorMode).toBe('BOT_SCRIPT');
  });

  it('hydrate restores a save payload silently', () => {
    const handler = vi.fn();
    eventBus.on('FOCUS_CHANGED', handler);
    useGameStore.getState().hydrate({
      completedQuests: ['q1'],
      codeByQuest: { q1: 'x' },
      focus: 42,
    });
    const s = useGameStore.getState();
    expect(s.completedQuests).toEqual(['q1']);
    expect(s.codeByQuest).toEqual({ q1: 'x' });
    expect(s.focus).toBe(42);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('gameStore — TAHAP A3 audit fixes (CORE-H1/M3/L1)', () => {
  it('CORE-L1: clampFocus maps NaN to 0 (never full focus); infinities clamp to bounds', () => {
    expect(clampFocus(Number.NaN)).toBe(0);
    expect(clampFocus(Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampFocus(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clampFocus(42.4)).toBe(42);
  });

  it('CORE-L1: setFocus/adjustFocus IGNORE non-finite input — focus and events unchanged', () => {
    const handler = vi.fn();
    eventBus.on('FOCUS_CHANGED', handler);
    useGameStore.getState().setFocus(40);
    expect(handler).toHaveBeenCalledTimes(1);
    useGameStore.getState().setFocus(Number.NaN);
    useGameStore.getState().setFocus(Number.POSITIVE_INFINITY);
    useGameStore.getState().adjustFocus(Number.NaN);
    expect(useGameStore.getState().focus).toBe(40);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('CORE-H1: completeQuest returns true only for the first completion', () => {
    expect(useGameStore.getState().completeQuest('q1')).toBe(true);
    expect(useGameStore.getState().completeQuest('q1')).toBe(false);
    expect(useGameStore.getState().completeQuest('q2')).toBe(true);
  });

  it('CORE-H1: the successPath reward pattern pays +20 ONCE across two successful runs', () => {
    // CyberDeckScreen.successPath is exactly:
    //   const first = completeQuest(id); if (first) adjustFocus(+20);
    // The dedupe decision lives in the store's return value (single source
    // of truth), so two runs of that pattern cannot pay twice.
    useGameStore.getState().setFocus(30);
    const successPathPattern = () => {
      const first = useGameStore.getState().completeQuest('q1');
      if (first) useGameStore.getState().adjustFocus(20);
    };
    successPathPattern();
    successPathPattern(); // replay of the already-solved quest
    expect(useGameStore.getState().focus).toBe(50);
  });

  it('CORE-M3: hydrate never throws on hostile shapes — fields degrade to defaults', () => {
    const hostile = (p: unknown) => p as PersistedProgress;
    expect(() =>
      useGameStore.getState().hydrate(hostile({ completedQuests: null, codeByQuest: {}, focus: 50 })),
    ).not.toThrow();
    expect(useGameStore.getState().completedQuests).toEqual([]);

    useGameStore.getState().hydrate(hostile({ completedQuests: 'abc', codeByQuest: {}, focus: 50 }));
    expect(useGameStore.getState().completedQuests).toEqual([]); // NOT ['a','b','c']

    useGameStore.getState().hydrate(hostile({ completedQuests: [], codeByQuest: null, focus: 50 }));
    expect(useGameStore.getState().codeByQuest).toEqual({});

    useGameStore.getState().hydrate(hostile(null));
    expect(useGameStore.getState()).toMatchObject({ completedQuests: [], codeByQuest: {}, focus: 100 });
  });

  it('CORE-M3: hydrate filters junk entries per-field and defaults garbage focus', () => {
    useGameStore.getState().hydrate({
      completedQuests: ['q1', 42, 'q2'] as unknown as string[],
      codeByQuest: { q1: 'SELECT 1', q2: 7 } as unknown as Record<string, string>,
      focus: 'x' as unknown as number,
    });
    const s = useGameStore.getState();
    expect(s.completedQuests).toEqual(['q1', 'q2']);
    expect(s.codeByQuest).toEqual({ q1: 'SELECT 1' });
    expect(s.focus).toBe(100);

    useGameStore.getState().hydrate({ completedQuests: [], codeByQuest: {}, focus: Number.NaN });
    expect(useGameStore.getState().focus).toBe(100);
    useGameStore.getState().hydrate({ completedQuests: [], codeByQuest: {}, focus: -5 });
    expect(useGameStore.getState().focus).toBe(0);
  });
});
