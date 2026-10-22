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
