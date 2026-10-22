/**
 * SoundController scheduler tests under a fake AudioContext (same pattern
 * as the TAHAP A audit probes). Focus: the CORE-L9 lag guard — after a
 * long stall the scheduler must NOT burst-schedule its backlog.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

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
  /** Every oscillator ever created (Fase 4 ambience tests inspect these). */
  static oscs: Array<{ frequency: FakeParam }> = [];
  currentTime = 0;
  state = 'running';
  sampleRate = 48000;
  destination = {};
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
    return { gain: new FakeParam(), connect: (d: unknown) => d };
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: new FakeParam(), connect: (d: unknown) => d };
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createOscillator() {
    this.oscCreated++;
    const osc = {
      type: 'sine',
      frequency: new FakeParam(),
      detune: new FakeParam(),
      connect: (d: unknown) => d,
      start() {},
      stop() {},
      onended: null as null | (() => void),
    };
    FakeAudioContext.oscs.push(osc);
    return osc;
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

describe('SoundController scheduler (CORE-L9 lag guard)', () => {
  let SC: typeof import('./SoundController');

  beforeAll(async () => {
    (globalThis as Record<string, unknown>)['window'] = { AudioContext: FakeAudioContext };
    (globalThis as Record<string, unknown>)['localStorage'] = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    SC = await import('./SoundController');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normal ticks schedule music sources (scheduler alive)', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    vi.advanceTimersByTime(25);
    expect(ctx.sourceCount()).toBeGreaterThan(0);
    c.stop();
  });

  it('a 30s stall does NOT burst: one catch-up tick schedules < 30 sources', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    vi.advanceTimersByTime(25); // one normal tick
    const before = ctx.sourceCount();
    ctx.currentTime += 30; // throttled tab / machine sleep
    vi.advanceTimersByTime(25); // single catch-up tick
    const burst = ctx.sourceCount() - before;
    c.stop();
    // Pre-fix this burst was ~170 sources. A guarded scheduler schedules
    // roughly one step's worth.
    expect(burst).toBeLessThan(30);
    expect(burst).toBeGreaterThan(0); // music still flows after the skip
  });

  it('exactly one scheduler interval while started, zero after stop', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    const base = vi.getTimerCount();
    await c.start();
    expect(vi.getTimerCount()).toBe(base + 1);
    c.stop();
    expect(vi.getTimerCount()).toBe(base);
  });
});

describe('SoundController village ambience (Fase 4)', () => {
  let SC: typeof import('./SoundController');

  beforeAll(async () => {
    SC = await import('./SoundController');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Bird chirps live at 2.2–3.7 kHz; no music voice goes above ~1.1 kHz. */
  const birdOscCount = () =>
    FakeAudioContext.oscs.filter((o) => o.frequency.value >= 2000).length;

  /** Simulate `seconds` of wall time: audio clock forward, ticks firing. */
  const advanceSeconds = (ctx: FakeAudioContext, seconds: number) => {
    for (let s = 0; s < seconds; s++) {
      ctx.currentTime += 1;
      vi.advanceTimersByTime(25);
    }
  };

  it('start() begins exactly one wind loop; a repeated start() adds none', async () => {
    vi.useFakeTimers();
    FakeAudioContext.oscs.length = 0;
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    // Before any scheduler tick: the only buffer source is the wind loop,
    // the only oscillator its breathing LFO.
    expect(ctx.bufSrcCreated).toBe(1);
    expect(ctx.oscCreated).toBe(1);
    await c.start(); // guarded by `started` — must be a no-op
    expect(ctx.bufSrcCreated).toBe(1);
    expect(ctx.oscCreated).toBe(1);
    c.stop();
  });

  it('stop() then start() rebuilds exactly one wind loop (no stacking)', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    c.stop();
    await c.start();
    expect(ctx.bufSrcCreated).toBe(2); // one per start, never two at once
    c.stop();
  });

  it('ambience adds no scheduler interval of its own', async () => {
    vi.useFakeTimers();
    const c = new SC.SoundController();
    const base = vi.getTimerCount();
    await c.start();
    expect(vi.getTimerCount()).toBe(base + 1); // the music tick only
    c.stop();
    expect(vi.getTimerCount()).toBe(base);
  });

  it('bird chirps are scheduled in village mode over time', async () => {
    vi.useFakeTimers();
    FakeAudioContext.oscs.length = 0;
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    advanceSeconds(ctx, 60);
    c.stop();
    // First chirp at +2 s, then every 4.5–11 s, 2–4 syllables each:
    // even the sparsest random walk yields >= 6 bird oscillators in 60 s.
    expect(birdOscCount()).toBeGreaterThanOrEqual(6);
  });

  it('no chirps in coding mode, while the music keeps playing', async () => {
    vi.useFakeTimers();
    FakeAudioContext.oscs.length = 0;
    const c = new SC.SoundController();
    c.setCodingMode(true);
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    advanceSeconds(ctx, 60);
    const sources = ctx.sourceCount();
    c.stop();
    expect(birdOscCount()).toBe(0);
    expect(sources).toBeGreaterThan(10); // music scheduler alive
  });

  it('a 30s stall does not burst chirps: at most one bird per catch-up tick', async () => {
    vi.useFakeTimers();
    FakeAudioContext.oscs.length = 0;
    const c = new SC.SoundController();
    await c.start();
    const ctx = FakeAudioContext.instances.at(-1)!;
    advanceSeconds(ctx, 10);
    const before = birdOscCount();
    ctx.currentTime += 30; // throttled tab / machine sleep
    vi.advanceTimersByTime(25); // single catch-up tick
    const burst = birdOscCount() - before;
    c.stop();
    expect(burst).toBeLessThanOrEqual(4); // one chirp = at most 4 syllables
  });
});
