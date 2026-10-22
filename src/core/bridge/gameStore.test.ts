import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from './eventBus';
import { useGameStore } from './gameStore';

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
