import { Howler } from 'howler';

/**
 * SoundController — all sound is SYNTHESIZED with WebAudio; there are no
 * external audio files in Fase 1 (docs/BLUEPRINT.md §5 "Audio").
 *
 * - playKeystroke(): mechanical-keyboard click (filtered noise + blip),
 *   pitch randomized ±8%, throttled to 30 ms.
 * - playSFX(name): small synth motifs (snap / success / fail / lever / ding).
 * - Generative adaptive music on ONE scheduler/clock:
 *     Track A = soft lofi pad + sub bass (Fmaj9–Dm9–Bbmaj9–C13…, 72 BPM swing)
 *     Track B = chiptune square arpeggio + soft hat
 *   setCodingMode(true) crossfades A 100%→40% and B 0%→100% over 1.5 s
 *   (BLUEPRINT §4B vertical mixing). Music is OFF until start() is called
 *   from a user gesture.
 * - Village ambience (Fase 4): a looping wind bed + sparse bird chirps on
 *   their own bus under the music, scheduled from the same tick; present
 *   in village mode, faded out in coding mode, governed by the same
 *   toggle/volume as the music. See startAmbience(). Master volume persists in localStorage
 *   `bitterra:music` and is mirrored to Howler (file-based layers in later
 *   phases play through Howler under the same master volume).
 * - Exactly one AudioContext, created lazily, reused across start/stop.
 * Every public method is safe to call before start() (silent no-op).
 */

export type SfxName = 'snap' | 'success' | 'fail' | 'lever' | 'ding';

const MUSIC_STORAGE_KEY = 'bitterra:music';
const DEFAULT_VOLUME = 0.7;
const BPM = 72;
const STEPS_PER_BAR = 8; // 8th notes
const STEP_DUR = 60 / BPM / 2;
const SWING = 0.14; // fraction of a step, applied to odd 8ths
const FADE_S = 1.5;
const MUSIC_LEVEL = 0.5;

/* Village ambience (Fase 4): a whisper-quiet synthesized nature layer
   UNDER the music — a looping wind bed plus sparse bird chirps. It rides
   the musicBus, so the one music toggle and the persisted master volume
   govern it exactly like the tracks; it follows the same coding-mode
   crossfade (village = present, deck = faded out). Levels are source-
   level gains into ambBus: wind 0.026 ± 0.012 (LFO 0.07 Hz), chirps peak
   0.032 — comparable to a single pad note, never a soundscape. */
const WIND_GAIN = 0.026;
const WIND_LFO_DEPTH = 0.012;
const WIND_LFO_HZ = 0.07;
const WIND_FILTER_HZ = 420;
const CHIRP_PEAK = 0.032;
const CHIRP_MIN_DELAY_S = 4.5;
const CHIRP_MAX_DELAY_S = 11;

interface Chord {
  bass: number; // midi
  pad: number[]; // midi notes, rootless voicing
  arp: number[]; // midi notes for the chiptune layer
}

const CHORDS: Chord[] = [
  { bass: 41, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79] }, // Fmaj9
  { bass: 38, pad: [53, 57, 60, 64], arp: [65, 69, 72, 76] }, // Dm9
  { bass: 46, pad: [53, 57, 60, 62], arp: [65, 69, 72, 74] }, // Bbmaj9
  { bass: 36, pad: [52, 58, 57, 62], arp: [64, 67, 69, 71] }, // C13
  { bass: 41, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79] }, // Fmaj9
  { bass: 45, pad: [55, 59, 60, 64], arp: [67, 71, 72, 76] }, // Am9
  { bass: 43, pad: [53, 57, 58, 62], arp: [65, 69, 71, 74] }, // Gm9
  { bass: 36, pad: [52, 58, 62, 65], arp: [64, 67, 71, 74] }, // C9
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, v));
}

function loadPersistedVolume(): number {
  try {
    const raw = localStorage.getItem(MUSIC_STORAGE_KEY);
    if (!raw) return DEFAULT_VOLUME;
    const parsed = JSON.parse(raw) as { volume?: unknown };
    return typeof parsed.volume === 'number' ? clamp01(parsed.volume) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export class SoundController {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private busA: GainNode | null = null;
  private busB: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sources = new Set<AudioScheduledSourceNode>();

  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextStepTime = 0;
  private ambienceOn = false;
  private nextChirpAt = 0;
  private started = false;
  private codingMode = false;
  private volume: number = loadPersistedVolume();
  private lastKeystrokeAt = 0;

  /* ------------------------------------------------------------ */
  /* Lifecycle                                                     */
  /* ------------------------------------------------------------ */

  isStarted(): boolean {
    return this.started;
  }

  getVolume(): number {
    return this.volume;
  }

  /** Create/resume the single context and start the music scheduler. */
  async start(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
        this.buildGraph();
      }
      await this.ctx.resume();
      if (!this.started) {
        this.started = true;
        this.step = 0;
        this.nextStepTime = this.ctx.currentTime + 0.08;
        this.applyMix(0); // snap to the current coding-mode mix
        this.startAmbience();
        this.schedulerTimer = setInterval(() => this.tick(), 25);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Stop the scheduler and silence everything (context is kept for reuse). */
  stop(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.started = false;
    // Ambience sources (wind loop + LFO) live in this.sources like every
    // other source, so the stop sweep below silences them too; the flags
    // reset so the next start() rebuilds exactly one ambience layer.
    this.ambienceOn = false;
    this.nextChirpAt = 0;
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already ended */
      }
    }
    this.sources.clear();
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ volume: this.volume }));
    } catch {
      /* storage unavailable — volume still applies for this session */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume * this.volume, this.ctx.currentTime, 0.03);
    }
    try {
      Howler.volume(this.volume);
    } catch {
      /* Howler not ready — WebAudio master already applied */
    }
  }

  /* ------------------------------------------------------------ */
  /* Adaptive mix                                                  */
  /* ------------------------------------------------------------ */

  setCodingMode(on: boolean): void {
    this.codingMode = on;
    this.applyMix(FADE_S);
  }

  private applyMix(fadeS: number): void {
    if (!this.ctx || !this.busA || !this.busB) return;
    const now = this.ctx.currentTime;
    const aTarget = (this.codingMode ? 0.4 : 1.0) * MUSIC_LEVEL;
    const bTarget = (this.codingMode ? 1.0 : 0.0) * MUSIC_LEVEL;
    // Ambience belongs to the village: full under Track A out in the
    // village, faded to zero while the Cyber-Deck is open (coding mode),
    // on the same 1.5 s crossfade as the tracks.
    const ambTarget = this.codingMode ? 0.0 : 1.0;
    for (const [bus, target] of [
      [this.busA, aTarget],
      [this.busB, bTarget],
      ...(this.ambBus ? [[this.ambBus, ambTarget] as const] : []),
    ] as const) {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      if (fadeS > 0) bus.gain.linearRampToValueAtTime(target, now + fadeS);
      else bus.gain.setValueAtTime(target, now);
    }
  }

  /* ------------------------------------------------------------ */
  /* Graph + scheduler                                             */
  /* ------------------------------------------------------------ */

  private buildGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume * this.volume;
    this.master.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 1;
    this.musicBus.connect(this.master);

    this.busA = ctx.createGain();
    this.busA.connect(this.musicBus);
    this.busB = ctx.createGain();
    this.busB.connect(this.musicBus);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0; // applyMix snaps/fades it to the mode level
    this.ambBus.connect(this.musicBus);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // Shared white-noise buffer (keystrokes, hats, clunks).
    const len = Math.floor(ctx.sampleRate * 0.5);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private track(node: AudioScheduledSourceNode): void {
    this.sources.add(node);
    node.onended = () => this.sources.delete(node);
  }

  private tick(): void {
    if (!this.ctx || !this.started) return;
    const ahead = 0.12;
    // Lag guard (audit CORE-L9): after a stall — throttled background tab,
    // machine sleep — nextStepTime can sit tens of seconds in the past and
    // the loop below would burst-schedule the entire backlog in one tick
    // (measured: ~170 sources after a 30 s jump). If we are more than one
    // step behind, skip the missed steps wholesale: realign to now in
    // whole steps so the chord progression stays coherent, and let the
    // normal lookahead schedule only the step(s) actually due.
    if (this.nextStepTime < this.ctx.currentTime - STEP_DUR) {
      const skipped = Math.ceil((this.ctx.currentTime - this.nextStepTime) / STEP_DUR);
      this.step += skipped;
      this.nextStepTime += skipped * STEP_DUR;
    }
    while (this.nextStepTime < this.ctx.currentTime + ahead) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.nextStepTime += STEP_DUR;
      this.step += 1;
    }
    this.scheduleAmbience();
  }

  /* ------------------------------------------------------------ */
  /* Village ambience (Fase 4)                                     */
  /* ------------------------------------------------------------ */

  /**
   * Start the wind bed exactly once per start(): a looping noise source
   * through a lowpass, its gain breathed by a slow LFO. Guarded by
   * `ambienceOn`, and start() itself is guarded by `started`, so scene
   * remounts and repeated toggles can never stack a second layer — the
   * lifecycle discipline of the CORE-L9 lag guard, applied to loops.
   */
  private startAmbience(): void {
    if (!this.ctx || !this.ambBus || !this.noiseBuffer || this.ambienceOn) return;
    const ctx = this.ctx;
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = WIND_FILTER_HZ;
    const windGain = ctx.createGain();
    windGain.gain.value = WIND_GAIN;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = WIND_LFO_HZ;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = WIND_LFO_DEPTH;
    lfo.connect(lfoDepth);
    lfoDepth.connect(windGain.gain);
    wind.connect(filter).connect(windGain).connect(this.ambBus);
    const now = ctx.currentTime;
    wind.start(now, Math.random() * 0.3);
    lfo.start(now);
    this.track(wind);
    this.track(lfo);
    this.ambienceOn = true;
    this.nextChirpAt = now + 2.0; // first bird arrives soon, then sparsely
  }

  private chirpDelay(): number {
    return CHIRP_MIN_DELAY_S + Math.random() * (CHIRP_MAX_DELAY_S - CHIRP_MIN_DELAY_S);
  }

  /**
   * Bird chirps are scheduled from the ONE music tick (no extra timer),
   * and only in village mode — in coding mode the ambience bus is faded
   * out anyway, so scheduling there would be pure waste. The same
   * realign-on-stall rule as the music lag guard applies: a long tab
   * stall moves the next chirp to the future instead of bursting.
   */
  private scheduleAmbience(): void {
    if (!this.ctx || !this.ambBus || !this.started || !this.ambienceOn) return;
    if (this.codingMode) return;
    const now = this.ctx.currentTime;
    if (this.nextChirpAt === 0 || this.nextChirpAt < now - 1) {
      this.nextChirpAt = now + this.chirpDelay();
    }
    if (this.nextChirpAt <= now + 0.12) {
      this.scheduleChirp(this.nextChirpAt);
      this.nextChirpAt += this.chirpDelay();
    }
  }

  /** One bird: 2–4 quick FM syllables, 2.4–3.1 kHz, peak CHIRP_PEAK. */
  private scheduleChirp(at: number): void {
    if (!this.ctx || !this.ambBus) return;
    const ctx = this.ctx;
    const syllables = 2 + Math.floor(Math.random() * 3);
    let t = at;
    for (let i = 0; i < syllables; i++) {
      const dur = 0.07 + Math.random() * 0.04;
      const f0 = 2400 + Math.random() * 700;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.18, t + dur * 0.45);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.92, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(CHIRP_PEAK, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.ambBus);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      this.track(osc);
      t += dur + 0.03 + Math.random() * 0.03;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.busA || !this.busB) return;
    const chord = CHORDS[Math.floor(step / STEPS_PER_BAR) % CHORDS.length];
    const stepInBar = step % STEPS_PER_BAR;
    const swingOffset = stepInBar % 2 === 1 ? STEP_DUR * SWING : 0;

    if (stepInBar === 0) {
      this.schedulePad(chord, time, STEP_DUR * STEPS_PER_BAR);
      this.scheduleBass(chord, time, STEP_DUR * STEPS_PER_BAR);
    }

    // Track B: chiptune arpeggio (square) + soft hat on offbeats.
    const arpNote = chord.arp[stepInBar % chord.arp.length];
    const accent = stepInBar % 4 === 0 ? 0.16 : 0.1;
    this.schedulePluck(midiToFreq(arpNote), time + swingOffset, accent);
    if (stepInBar % 4 === 2) {
      this.scheduleNoise(this.busB, time + swingOffset, {
        type: 'highpass',
        freq: 8000,
        dur: 0.03,
        gain: 0.05,
      });
    }
  }

  private schedulePad(chord: Chord, time: number, barDur: number): void {
    if (!this.ctx || !this.busA) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    filter.connect(this.busA);
    for (const note of chord.pad) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(note);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(0.045, time + 0.4);
        g.gain.setValueAtTime(0.045, time + barDur - 0.5);
        g.gain.linearRampToValueAtTime(0, time + barDur + 0.1);
        osc.connect(g).connect(filter);
        osc.start(time);
        osc.stop(time + barDur + 0.15);
        this.track(osc);
      }
    }
  }

  private scheduleBass(chord: Chord, time: number, barDur: number): void {
    if (!this.ctx || !this.busA) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToFreq(chord.bass);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.22, time + 0.03);
    g.gain.setTargetAtTime(0.12, time + 0.1, barDur / 3);
    g.gain.setValueAtTime(0.0, time + barDur);
    osc.connect(g).connect(this.busA);
    osc.start(time);
    osc.stop(time + barDur + 0.05);
    this.track(osc);
  }

  private schedulePluck(freq: number, time: number, gain: number): void {
    if (!this.ctx || !this.busB) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(g).connect(this.busB);
    osc.start(time);
    osc.stop(time + 0.2);
    this.track(osc);
  }

  private scheduleNoise(
    dest: AudioNode,
    time: number,
    opts: { type: BiquadFilterType; freq: number; dur: number; gain: number; rate?: number },
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = opts.rate ?? 1;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + opts.dur);
    src.connect(filter).connect(g).connect(dest);
    src.start(time, Math.random() * 0.3);
    src.stop(time + opts.dur + 0.02);
    this.track(src);
  }

  /* ------------------------------------------------------------ */
  /* One-shot synth (keystrokes + SFX)                             */
  /* ------------------------------------------------------------ */

  private tone(
    dest: AudioNode,
    freq: number,
    opts: {
      type?: OscillatorType;
      at?: number;
      dur?: number;
      gain?: number;
      slideTo?: number;
    } = {},
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const time = opts.at ?? ctx.currentTime;
    const dur = opts.dur ?? 0.15;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, time);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo), time + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.15, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g).connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    this.track(osc);
  }

  private ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !!this.sfxBus;
  }

  /** Mechanical keyboard click — pitch ±8%, throttled to 30 ms. */
  playKeystroke(): void {
    if (!this.ready() || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    if (nowMs - this.lastKeystrokeAt < 30) return;
    this.lastKeystrokeAt = nowMs;
    const now = this.ctx.currentTime;
    const rate = 0.95 + Math.random() * 0.1;
    this.scheduleNoise(this.sfxBus, now, {
      type: 'bandpass',
      freq: 1700 + Math.random() * 1100,
      dur: 0.045,
      gain: 0.22,
      rate,
    });
    this.tone(this.sfxBus, 1250 * rate, { type: 'triangle', at: now, dur: 0.03, gain: 0.05 });
  }

  playSFX(name: SfxName): void {
    if (!this.ready() || !this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const bus = this.sfxBus;
    const now = ctx.currentTime;
    switch (name) {
      case 'snap': // cartridge snapping into the Cyber-Deck
        this.scheduleNoise(bus, now, { type: 'bandpass', freq: 2400, dur: 0.05, gain: 0.3 });
        this.tone(bus, 175, { type: 'square', at: now, dur: 0.04, gain: 0.12 });
        break;
      case 'ding': // one data row processed
        this.tone(bus, 1568, { at: now, dur: 0.16, gain: 0.14 });
        this.tone(bus, 2093, { at: now + 0.02, dur: 0.12, gain: 0.06 });
        break;
      case 'success': // quest solved — little rising arp
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(bus, f, { type: 'triangle', at: now + i * 0.07, dur: 0.16, gain: 0.15 }),
        );
        break;
      case 'fail': // gentle comedic blip — never a harsh buzzer
        this.tone(bus, 196, { type: 'square', at: now, dur: 0.22, gain: 0.07, slideTo: 147 });
        this.tone(bus, 110, { at: now, dur: 0.2, gain: 0.08 });
        break;
      case 'lever': // physical RUN lever: clunk, whirr, ding
        this.scheduleNoise(bus, now, { type: 'lowpass', freq: 480, dur: 0.12, gain: 0.3 });
        this.tone(bus, 140, { at: now, dur: 0.2, gain: 0.22, slideTo: 55 });
        this.tone(bus, 1175, { at: now + 0.14, dur: 0.12, gain: 0.09 });
        break;
    }
  }

  /* Static convenience delegates — some UI call sites address the class as
     a namespace (SoundController.playSFX('snap')). They forward to the
     shared singleton, so there is still exactly one AudioContext. */
  static playSFX(name: SfxName): void {
    sharedSoundController().playSFX(name);
  }

  static playKeystroke(): void {
    sharedSoundController().playKeystroke();
  }

  static setCodingMode(on: boolean): void {
    sharedSoundController().setCodingMode(on);
  }
}

let sharedInstance: SoundController | null = null;

function sharedSoundController(): SoundController {
  if (!sharedInstance) sharedInstance = new SoundController();
  return sharedInstance;
}

/** App-wide singleton — one AudioContext for the whole game. */
export const soundController = sharedSoundController();
