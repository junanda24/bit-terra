/**
 * DEEP AUDIT PROBES — core layer (bridge / persistence / audio).
 * Read-only audit artifact: assertions document OBSERVED behavior.
 * Tests named "OBSERVED:" pin behavior that constitutes a finding;
 * the rest pin behavior verified as correct.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import {
  inspectEnvelope,
  parseSaveText,
  buildEnvelope,
  save,
  flushSave,
  type SavePayload,
} from '../core/persistence/saveSystem';
import { useGameStore, type PersistedProgress } from '../core/bridge/gameStore';
import { eventBus } from '../core/bridge/eventBus';

const VALID_PAYLOAD: SavePayload = { completedQuests: ['q1'], codeByQuest: { q1: 'SELECT 1' }, focus: 80 };
const env = (payload: unknown, extra: Record<string, unknown> = {}) => ({
  version: 1,
  savedAt: '2026-10-22T00:00:00.000Z',
  payload,
  ...extra,
});

function resetStore() {
  useGameStore.setState({
    completedQuests: [],
    codeByQuest: {},
    focus: 100,
    currentQuestId: null,
    editorMode: 'SQL',
    codingMode: false,
    pikoLine: null,
  });
}

/* ------------------------------------------------------------------ */
/* 1. SAVE HOSTILITY — pure envelope functions                          */
/* ------------------------------------------------------------------ */
describe('audit: hostile envelopes', () => {
  it('rejects completedQuests as a string', () => {
    const r = inspectEnvelope(env({ completedQuests: 'abc', codeByQuest: {}, focus: 50 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('corrupt');
  });

  it('rejects codeByQuest: null', () => {
    const r = inspectEnvelope(env({ completedQuests: [], codeByQuest: null, focus: 50 }));
    expect(r.ok).toBe(false);
  });

  it('rejects focus as string / NaN (whole save dies for one bad field)', () => {
    expect(inspectEnvelope(env({ ...VALID_PAYLOAD, focus: 'x' })).ok).toBe(false);
    expect(inspectEnvelope(env({ ...VALID_PAYLOAD, focus: NaN })).ok).toBe(false);
  });

  it('clamps focus -5 -> 0 and 99999 -> 100 instead of rejecting', () => {
    const lo = inspectEnvelope(env({ ...VALID_PAYLOAD, focus: -5 }));
    const hi = inspectEnvelope(env({ ...VALID_PAYLOAD, focus: 99999 }));
    expect(lo.ok && lo.envelope.payload.focus).toBe(0);
    expect(hi.ok && hi.envelope.payload.focus).toBe(100);
  });

  it('flags numeric versions 0 / 2 / 999 as version errors; string "1" as corrupt', () => {
    for (const v of [0, 2, 999]) {
      const r = inspectEnvelope({ ...env(VALID_PAYLOAD), version: v });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('version');
    }
    const rs = inspectEnvelope({ ...env(VALID_PAYLOAD), version: '1' });
    expect(rs.ok).toBe(false);
    if (!rs.ok) expect(rs.reason).toBe('corrupt');
  });

  it('OBSERVED: savedAt is only type-checked — a garbage date string is accepted', () => {
    const r = inspectEnvelope({ version: 1, savedAt: 'BUKAN TANGGAL SAMA SEKALI', payload: VALID_PAYLOAD });
    expect(r.ok).toBe(true);
  });

  it('OBSERVED: unknown extra fields (envelope + payload) are silently dropped, save accepted', () => {
    const r = inspectEnvelope(env({ ...VALID_PAYLOAD, evilExtra: 'x' }, { backdoor: 1 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect('evilExtra' in r.envelope.payload).toBe(false);
      expect('backdoor' in r.envelope).toBe(false);
    }
  });

  it('no prototype pollution via __proto__ keys in codeByQuest (JSON path)', () => {
    const text =
      '{"version":1,"savedAt":"2026-10-22T00:00:00.000Z","payload":{"completedQuests":[],"codeByQuest":{"__proto__":"polluted"},"focus":50}}';
    const r = parseSaveText(text);
    expect(r.ok).toBe(true);
    expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    if (r.ok) {
      expect(Object.prototype.hasOwnProperty.call(r.envelope.payload.codeByQuest, '__proto__')).toBe(true);
    }
  });

  it('OBSERVED: no size bounds — 1MB code string and 10k quest entries are accepted', () => {
    const big = 'x'.repeat(1_000_000);
    const r = inspectEnvelope(
      env({ completedQuests: Array.from({ length: 10_000 }, () => 'q'), codeByQuest: { q1: big }, focus: 50 }),
    );
    expect(r.ok).toBe(true);
  });

  it('OBSERVED: buildEnvelope silently replaces an invalid payload with EMPTY progress', () => {
    // If any future caller hands buildEnvelope/saveNow a payload that fails
    // sanitize (e.g. focus NaN), the written save is a total wipe, not an error.
    const e = buildEnvelope({ completedQuests: ['q1', 'q2'], codeByQuest: { q1: 'code' }, focus: NaN });
    expect(e.payload).toEqual({ completedQuests: [], codeByQuest: {}, focus: 100 });
  });
});

/* ------------------------------------------------------------------ */
/* 1b. hydrate() — the store's unvalidated trust boundary               */
/* ------------------------------------------------------------------ */
describe('audit: hydrate hostility', () => {
  afterEach(resetStore);

  it('OBSERVED: hydrate(completedQuests: null) THROWS a TypeError', () => {
    const hostile = { completedQuests: null, codeByQuest: {}, focus: 50 } as unknown as PersistedProgress;
    expect(() => useGameStore.getState().hydrate(hostile)).toThrow(TypeError);
  });

  it('OBSERVED: hydrate(completedQuests: "abc") silently stores ["a","b","c"] as quest ids', () => {
    const hostile = { completedQuests: 'abc', codeByQuest: {}, focus: 50 } as unknown as PersistedProgress;
    useGameStore.getState().hydrate(hostile);
    expect(useGameStore.getState().completedQuests).toEqual(['a', 'b', 'c']);
  });

  it('OBSERVED: hydrate(codeByQuest: null) silently becomes {} — no validation at all', () => {
    const hostile = { completedQuests: [], codeByQuest: null, focus: 50 } as unknown as PersistedProgress;
    useGameStore.getState().hydrate(hostile);
    expect(useGameStore.getState().codeByQuest).toEqual({});
  });

  it('sanitized-path sanity: a payload that passed inspectEnvelope hydrates exactly', () => {
    const r = inspectEnvelope(env(VALID_PAYLOAD));
    expect(r.ok).toBe(true);
    if (r.ok) {
      useGameStore.getState().hydrate(r.envelope.payload);
      const s = useGameStore.getState();
      expect(s.completedQuests).toEqual(['q1']);
      expect(s.codeByQuest).toEqual({ q1: 'SELECT 1' });
      expect(s.focus).toBe(80);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4. STORE SEMANTICS                                                   */
/* ------------------------------------------------------------------ */
describe('audit: store semantics', () => {
  afterEach(resetStore);

  it('OBSERVED: setFocus(NaN) silently becomes FULL focus (100) and emits it', () => {
    resetStore();
    useGameStore.getState().setFocus(40);
    const seen: number[] = [];
    const h = (e: { focus: number }) => seen.push(e.focus);
    eventBus.on('FOCUS_CHANGED', h);
    useGameStore.getState().setFocus(NaN);
    eventBus.off('FOCUS_CHANGED', h);
    expect(useGameStore.getState().focus).toBe(100);
    expect(seen).toEqual([100]);
  });

  it('OBSERVED: focus farming asymmetry — completeQuest dedupes its event, the +20 refill does not dedupe', () => {
    // Mirrors CyberDeckScreen.successPath exactly:
    //   completeQuest(quest.id); adjustFocus(FOCUS_SUCCESS_REWARD);
    // Re-running an already-completed quest successfully re-enters successPath.
    resetStore();
    useGameStore.getState().setFocus(30);
    let completedEvents = 0;
    const h = () => completedEvents++;
    eventBus.on('QUEST_COMPLETED', h);
    const successPath = () => {
      useGameStore.getState().completeQuest('q1');
      useGameStore.getState().adjustFocus(20);
    };
    successPath();
    successPath(); // second successful RUN on the same, already-completed quest
    eventBus.off('QUEST_COMPLETED', h);
    expect(completedEvents).toBe(1); // store dedupes the completion…
    expect(useGameStore.getState().focus).toBe(70); // …but the refill paid out twice (30+20+20)
  });

  it('OBSERVED: resetProgress changes focus 30 -> 100 with NO FOCUS_CHANGED event (store/event desync)', () => {
    resetStore();
    let focusEvents = 0;
    const h = () => focusEvents++;
    eventBus.on('FOCUS_CHANGED', h);
    useGameStore.getState().setFocus(30);
    expect(focusEvents).toBe(1);
    useGameStore.getState().resetProgress();
    eventBus.off('FOCUS_CHANGED', h);
    expect(useGameStore.getState().focus).toBe(100);
    expect(focusEvents).toBe(1); // reset was silent on the bus
  });

  it('OBSERVED: sayPiko overwrites unconditionally; clearPiko has no bus counterpart', () => {
    resetStore();
    const seen: string[] = [];
    const h = (e: { text: string }) => seen.push(e.text);
    eventBus.on('PIKO_SAY', h);
    useGameStore.getState().sayPiko('pertama', 'normal');
    useGameStore.getState().sayPiko('kedua', 'happy');
    expect(useGameStore.getState().pikoLine?.text).toBe('kedua');
    useGameStore.getState().clearPiko();
    eventBus.off('PIKO_SAY', h);
    expect(useGameStore.getState().pikoLine).toBeNull();
    expect(seen).toEqual(['pertama', 'kedua']); // no "clear" event exists
  });

  it('OBSERVED: setCurrentQuest without a mode keeps the previous quest mode (stale-mode carryover)', () => {
    resetStore();
    useGameStore.getState().setCurrentQuest('q-bot', 'BOT_SCRIPT');
    useGameStore.getState().setCurrentQuest('q-sql'); // mode omitted
    expect(useGameStore.getState().editorMode).toBe('BOT_SCRIPT');
  });

  it('clamp integrity via adjustFocus at both ends', () => {
    resetStore();
    useGameStore.getState().adjustFocus(-9999);
    expect(useGameStore.getState().focus).toBe(0);
    useGameStore.getState().adjustFocus(9999);
    expect(useGameStore.getState().focus).toBe(100);
  });
});

/* ------------------------------------------------------------------ */
/* 3. AUTOSAVE DEBOUNCE — observability probes (node: no IndexedDB)     */
/* ------------------------------------------------------------------ */
describe('audit: autosave debounce', () => {
  it('flushSave returns true when nothing is pending', async () => {
    await expect(flushSave()).resolves.toBe(true);
  });

  it('OBSERVED: after save(), a pending payload exists that only the timer or flushSave can make durable', async () => {
    save(VALID_PAYLOAD);
    // In node the write itself fails (no IndexedDB) -> false proves flush
    // ATTEMPTED a write, i.e. a pending payload really was sitting unsaved.
    await expect(flushSave()).resolves.toBe(false);
    // …and after flushing, nothing remains pending.
    await expect(flushSave()).resolves.toBe(true);
  });

  it('OBSERVED: payload is NOT durable until the 800ms trailing edge fires', async () => {
    save(VALID_PAYLOAD);
    await new Promise((r) => setTimeout(r, 950)); // let the trailing edge fire
    // The timer consumed the pending payload (attempted + failed silently in
    // node); nothing is left for flushSave to do.
    await expect(flushSave()).resolves.toBe(true);
  }, 5000);
});


/* ------------------------------------------------------------------ */
/* 5. AUDIO — SoundController under a fake AudioContext                 */
/* ------------------------------------------------------------------ */

class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  state = 'running';
  sampleRate = 48000;
  destination = {};
  gains: { gain: FakeParam }[] = [];
  oscCreated = 0;
  bufSrcCreated = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  createGain() {
    const g = { gain: new FakeParam(), connect: (d: unknown) => d };
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: new FakeParam(), connect: (d: unknown) => d };
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createOscillator() {
    this.oscCreated++;
    return {
      type: 'sine',
      frequency: new FakeParam(),
      detune: new FakeParam(),
      connect: (d: unknown) => d,
      start() {},
      stop() {},
      onended: null as null | (() => void),
    };
  }
  createBufferSource() {
    this.bufSrcCreated++;
    return {
      buffer: null as unknown,
      playbackRate: new FakeParam(),
      connect: (d: unknown) => d,
      start() {},
      stop() {},
      onended: null as null | (() => void),
    };
  }
  sourceCount() {
    return this.oscCreated + this.bufSrcCreated;
  }
}

describe('audit: SoundController', () => {
  let SC: typeof import('../core/audio/SoundController');
  let storageRaw: string | null = null;

  beforeAll(async () => {
    (globalThis as Record<string, unknown>)['window'] = { AudioContext: FakeAudioContext };
    (globalThis as Record<string, unknown>)['localStorage'] = {
      getItem: () => storageRaw,
      setItem: () => {},
      removeItem: () => {},
    };
    SC = await import('../core/audio/SoundController');
  });

  afterEach(() => {
    vi.useRealTimers();
    storageRaw = null;
  });

  it('volume: corrupted localStorage values fall back or clamp, never NaN', () => {
    storageRaw = 'bukan json{';
    expect(new SC.SoundController().getVolume()).toBe(0.7);
    storageRaw = '{"volume":"x"}';
    expect(new SC.SoundController().getVolume()).toBe(0.7);
    storageRaw = '{"volume":999}';
    expect(new SC.SoundController().getVolume()).toBe(1);
    storageRaw = '{"volume":-2}';
    expect(new SC.SoundController().getVolume()).toBe(0);
    storageRaw = '{"volume":0.25}';
    expect(new SC.SoundController().getVolume()).toBe(0.25);
    storageRaw = '0.5'; // bare number format is NOT the stored shape -> default
    expect(new SC.SoundController().getVolume()).toBe(0.7);
  });

  it('pre-start SFX/keystroke calls are silent no-ops (no throw)', () => {
    const c = new SC.SoundController();
    expect(() => c.playKeystroke()).not.toThrow();
    expect(() => c.playSFX('ding')).not.toThrow();
    expect(() => c.setCodingMode(true)).not.toThrow();
  });

  it('start/stop cycles: exactly one scheduler interval while started, zero after stop', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    const base = vi.getTimerCount();
    await c.start();
    expect(vi.getTimerCount()).toBe(base + 1);
    c.stop();
    expect(vi.getTimerCount()).toBe(base);
    await c.start();
    expect(vi.getTimerCount()).toBe(base + 1);
    c.stop();
    expect(vi.getTimerCount()).toBe(base);
    expect((c as unknown as { sources: Set<unknown> }).sources.size).toBe(0);
  });

  it('concurrent double start() does not double the scheduler', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    const base = vi.getTimerCount();
    await Promise.all([c.start(), c.start()]);
    expect(vi.getTimerCount()).toBe(base + 1);
    c.stop();
  });

  it('setCodingMode(true) BEFORE start() is honored: bus B snaps to 0.5 at start', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    c.setCodingMode(true);
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    // buildGraph order: master, musicBus, busA, busB, sfxBus
    expect(ctx.gains[3].gain.value).toBeCloseTo(0.5);
    c.stop();
  });

  it('OBSERVED: scheduler has NO lag guard — a 30s stall fires a burst of ~140 sources in one tick', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    vi.advanceTimersByTime(25); // one normal tick
    const before = ctx.sourceCount();
    ctx.currentTime += 30; // tab throttled / machine slept while ctx kept running
    vi.advanceTimersByTime(25); // single catch-up tick
    const burst = ctx.sourceCount() - before;
    c.stop();
    // A guarded scheduler would clamp to ~1 step (<= ~12 sources).
    expect(burst).toBeGreaterThan(100);
  });

  it('keystroke throttle: fires, blocks inside 30ms, fires again after', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    vi.advanceTimersByTime(100); // move performance clock past the initial lastKeystrokeAt=0
    const s0 = ctx.sourceCount();
    c.playKeystroke();
    const s1 = ctx.sourceCount();
    expect(s1 - s0).toBe(2); // noise burst + blip tone
    c.playKeystroke(); // same fake instant -> throttled
    expect(ctx.sourceCount() - s1).toBe(0);
    vi.advanceTimersByTime(31);
    const s2 = ctx.sourceCount();
    c.playKeystroke();
    expect(ctx.sourceCount() - s2).toBe(2);
    c.stop();
  });
});
