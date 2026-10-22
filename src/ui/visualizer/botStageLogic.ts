import type { QuestDefinition } from '../../shared/types';

/**
 * Logika murni panggung bot (tanpa React/DOM) — diekstrak dari BotGridStage
 * supaya semantik dunia Q1 bisa diuji langsung (temuan playtest F-01/F-02/F-12):
 *
 * - Urutan boot DITEGAKKAN di dunia: selama Piko belum bangun (boot() belum
 *   dipanggil pada run ini), aksi move/turn/charge GAGAL TOTAL (fizzle) —
 *   tidak ada gerakan, tidak ada isi daya, hanya igauan "Zzz". Pelajaran
 *   sequencing Q1 tidak bisa lagi diakali dengan menulis boot() terakhir.
 * - Isi daya di luar petak target adalah sinyal SENDIRI ('charged-dark',
 *   kedipan zap redup) — bukan tabrakan. Tabrakan hanya lahir dari rintangan /
 *   batas grid sungguhan dan terkunci per run (crashed + crashKind).
 * - moveForward(0) benar-benar 0 langkah; negatif juga 0 (dulu di-clamp ke 1).
 */

type BotWorldSetup = NonNullable<QuestDefinition['botWorldSetup']>;

/** 0 = timur, 1 = selatan, 2 = barat, 3 = utara. */
export type Facing = 0 | 1 | 2 | 3;

export type BotActionKind =
  | 'move'
  | 'turn-left'
  | 'turn-right'
  | 'boot'
  | 'charge'
  | 'open'
  | 'close'
  | 'unknown';

/** Normalisasi nama aksi bot: "piko.moveForward" → move, "gate.open" → open. */
export function normalizeBotAction(action: string): BotActionKind {
  const base = action.split('.').pop()?.toLowerCase() ?? '';
  if (base === 'moveforward' || base === 'move' || base === 'forward' || base === 'step') return 'move';
  if (base === 'turnleft' || base === 'left') return 'turn-left';
  if (base === 'turnright' || base === 'right') return 'turn-right';
  if (base === 'boot' || base === 'wake' || base === 'wakeup' || base === 'on') return 'boot';
  if (base === 'charge' || base === 'charging' || base === 'isi-daya') return 'charge';
  if (base === 'open') return 'open';
  if (base === 'close') return 'close';
  return 'unknown';
}

/**
 * Jumlah langkah dari argumen moveForward. Angka difloor-kan (selaras
 * MockBot), lalu di-clamp ke 0..12: 0 tetap 0, negatif menjadi 0 — kode
 * pemain tidak boleh dibohongi dunia (F-12a). Argumen bukan angka → 1
 * (pemanggilan tanpa argumen berarti satu langkah).
 */
export function normalizeMoveSteps(arg: unknown): number {
  if (typeof arg === 'number' && Number.isFinite(arg)) {
    return Math.max(0, Math.min(12, Math.trunc(arg)));
  }
  return 1;
}

export type BotCrashKind = 'obstacle' | 'bounds';

/** Status turunan untuk label & sinyal visual panggung. */
export type BotStageStatus = 'asleep' | 'charged-dark' | 'crashed' | 'charged' | 'active';

export interface BotStageState {
  x: number;
  y: number;
  facing: Facing;
  awake: boolean;
  /** Terisi daya DI petak target — satu-satunya charge yang sah. */
  charged: boolean;
  /** Pernah mencoba charge di luar petak target pada run ini. */
  chargedDark: boolean;
  /** Menabrak rintangan / batas grid pada run ini (terkunci sampai reset). */
  crashed: boolean;
  crashKind: BotCrashKind | null;
  /** Ada aksi move/turn/charge yang gagal karena Piko masih tertidur. */
  actedWhileAsleep: boolean;
  onTarget: boolean;
  // — sinyal visual sesaat (dibersihkan aksi 'clear-transients') —
  dizzy: boolean;
  sleepFizzle: boolean;
  dimZap: boolean;
  status: BotStageStatus;
}

function deriveStatus(s: Omit<BotStageState, 'status'>): BotStageStatus {
  if (!s.awake) return 'asleep';
  if (s.chargedDark && !s.charged) return 'charged-dark';
  if (s.crashed) return 'crashed';
  if (s.charged) return 'charged';
  return 'active';
}

function withStatus(s: Omit<BotStageState, 'status'>): BotStageState {
  return { ...s, status: deriveStatus(s) };
}

export function createBotStageState(
  setup: BotWorldSetup,
  startPos: [number, number] = [0, 0],
): BotStageState {
  const [sx, sy] = startPos;
  return withStatus({
    x: sx,
    y: sy,
    facing: 0,
    awake: false,
    charged: false,
    chargedDark: false,
    crashed: false,
    crashKind: null,
    actedWhileAsleep: false,
    onTarget: setup.targets.some(([tx, ty]) => tx === sx && ty === sy),
    dizzy: false,
    sleepFizzle: false,
    dimZap: false,
  });
}

export type BotStageAction =
  | { type: 'bot'; kind: BotActionKind; stepsArg?: unknown }
  | { type: 'funny-fail'; reactionKey: string }
  | { type: 'clear-transients' }
  | { type: 'reset'; startPos?: [number, number] };

const DELTAS: Record<Facing, [number, number]> = {
  0: [1, 0],
  1: [0, 1],
  2: [-1, 0],
  3: [0, -1],
};

/** Buat reducer panggung yang terikat pada satu setup dunia (grid/rintangan/target). */
export function createBotStageReducer(setup: BotWorldSetup) {
  const [cols, rows] = setup.gridSize;
  const obstacleSet = new Set(setup.obstacles.map(([x, y]) => `${x},${y}`));
  const targetSet = new Set(setup.targets.map(([x, y]) => `${x},${y}`));
  const onTarget = (x: number, y: number) => targetSet.has(`${x},${y}`);

  return function botStageReducer(
    state: BotStageState,
    action: BotStageAction,
  ): BotStageState {
    switch (action.type) {
      case 'reset':
        return createBotStageState(setup, action.startPos ?? [0, 0]);

      case 'clear-transients':
        if (!state.dizzy && !state.sleepFizzle && !state.dimZap) return state;
        return withStatus({ ...state, dizzy: false, sleepFizzle: false, dimZap: false });

      case 'funny-fail': {
        // Sinyal visual mengikuti JENIS kegagalannya (F-02): bintang pusing
        // hanya untuk tabrakan sungguhan; charge gelap = zap redup; urutan
        // salah saat tertidur = igauan Zzz.
        if (action.reactionKey === 'hit_obstacle' || action.reactionKey === 'out_of_bounds') {
          return withStatus({ ...state, dizzy: true });
        }
        if (action.reactionKey === 'not_on_target') {
          return withStatus({ ...state, dimZap: true });
        }
        if (action.reactionKey === 'wrong_order') {
          return withStatus({ ...state, sleepFizzle: true });
        }
        return state;
      }

      case 'bot': {
        // Setiap aksi baru membersihkan sinyal sesaat aksi sebelumnya.
        const base: Omit<BotStageState, 'status'> = {
          ...state,
          dizzy: false,
          sleepFizzle: false,
          dimZap: false,
        };
        switch (action.kind) {
          case 'boot':
            return withStatus({ ...base, awake: true });

          case 'turn-left':
          case 'turn-right': {
            if (!base.awake) {
              return withStatus({ ...base, sleepFizzle: true, actedWhileAsleep: true });
            }
            const delta = action.kind === 'turn-left' ? 3 : 1;
            return withStatus({ ...base, facing: ((base.facing + delta) % 4) as Facing });
          }

          case 'move': {
            if (!base.awake) {
              // F-01: robot tertidur tidak berjalan — perintahnya menguap.
              return withStatus({ ...base, sleepFizzle: true, actedWhileAsleep: true });
            }
            const steps = normalizeMoveSteps(action.stepsArg);
            const [dx, dy] = DELTAS[base.facing];
            let nx = base.x;
            let ny = base.y;
            let crashKind: BotCrashKind | null = null;
            for (let i = 0; i < steps; i++) {
              const tx = nx + dx;
              const ty = ny + dy;
              if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) {
                crashKind = 'bounds';
                break;
              }
              if (obstacleSet.has(`${tx},${ty}`)) {
                crashKind = 'obstacle';
                break;
              }
              nx = tx;
              ny = ty;
            }
            return withStatus({
              ...base,
              x: nx,
              y: ny,
              onTarget: onTarget(nx, ny),
              crashed: base.crashed || crashKind !== null,
              crashKind: base.crashKind ?? crashKind,
              dizzy: crashKind !== null ? true : base.dizzy,
            });
          }

          case 'charge': {
            if (!base.awake) {
              // F-01: robot tertidur tidak mengisi daya.
              return withStatus({ ...base, sleepFizzle: true, actedWhileAsleep: true });
            }
            if (onTarget(base.x, base.y)) {
              return withStatus({ ...base, charged: true });
            }
            // F-02: charge di tempat gelap = sinyalnya sendiri, BUKAN tabrakan.
            return withStatus({ ...base, chargedDark: true, dimZap: true });
          }

          default:
            // 'open' / 'close' (pintu air) & aksi asing: bukan urusan tubuh
            // Piko di panggung ini — tidak mengubah pose.
            return withStatus(base);
        }
      }
    }
  };
}

/**
 * Teks label status panggung. Prioritasnya jujur (F-12b): status tertidur
 * selalu menang atas "daya terisi" — charge yang sah pun mensyaratkan bangun.
 */
export function botStageStatusText(state: BotStageState): string {
  if (!state.awake) return 'Piko tertidur';
  if (state.charged) return 'Daya terisi penuh';
  if (state.status === 'charged-dark') return 'Tidak ada cahaya di sini';
  return 'Piko aktif';
}

export type BotVerdict =
  | { kind: 'success' }
  | { kind: 'fail'; reactionKey: string };

/**
 * Verdict akhir run bot dari pose akhir + kunci reaksi yang tersedia di data
 * quest. Urutannya mengikuti temuan playtest (perbaikan F-01/F-02):
 * sukses → keluarga belum-bangun/urutan → tabrakan sungguhan → charge di
 * luar target → sampai di cahaya tapi tidak charge → di luar target.
 * Tabrakan TIDAK lagi menjadi pemeriksaan pertama yang menelan segalanya.
 */
export function botQuestVerdict(
  state: BotStageState,
  reactions: Record<string, string>,
): BotVerdict {
  const pick = (...keys: string[]): string =>
    keys.find((k) => k in reactions) ?? keys[0] ?? 'wrong_result';

  if (state.awake && state.onTarget && state.charged) return { kind: 'success' };

  if (!state.awake || state.actedWhileAsleep) {
    return { kind: 'fail', reactionKey: pick('wrong_order', 'no_charge') };
  }
  if (state.crashed) {
    return {
      kind: 'fail',
      reactionKey:
        state.crashKind === 'bounds'
          ? pick('out_of_bounds', 'hit_obstacle')
          : pick('hit_obstacle', 'out_of_bounds'),
    };
  }
  if (state.chargedDark && !state.onTarget) {
    return { kind: 'fail', reactionKey: pick('not_on_target', 'no_charge') };
  }
  if (state.onTarget && !state.charged) {
    return { kind: 'fail', reactionKey: pick('no_charge', 'not_on_target') };
  }
  if (!state.onTarget) {
    return { kind: 'fail', reactionKey: pick('not_on_target', 'no_charge') };
  }
  return { kind: 'fail', reactionKey: pick('wrong_result') };
}
