import type {
  BotScenario,
  BotScenarioExpectation,
  QuestDefinition,
} from '../../shared/types';

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
  | 'water'
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
  if (base === 'water' || base === 'siram') return 'water';
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
  // — dunia Fase 3: pintu air, peti dorong, tanaman (sumber kebenaran di
  // `boxes`/`wateredPlants`; hitungan & bendera di bawah ini TURUNAN yang
  // dihitung ulang tiap transisi oleh deriveCounts) —
  /** Pintu air terbuka? (gate.open/close; Q3). */
  gateOpen: boolean;
  /** Posisi peti saat ini (Q5). */
  boxes: [number, number][];
  /** Kunci petak "x,y" tanaman yang sudah tersiram (Q7). */
  wateredPlants: string[];
  /** Berapa kali water() menyiram petak tanpa tanaman (percikan percuma). */
  waterWasted: number;
  boxesPlaced: number;
  boxesTotal: number;
  /** Ada peti terjepit di tepi grid di luar target — tidak bisa diselamatkan. */
  boxesStuck: boolean;
  allBoxesOnTargets: boolean;
  plantsWatered: number;
  plantsTotal: number;
  allPlantsWatered: boolean;
  // — sinyal visual sesaat (dibersihkan aksi 'clear-transients') —
  dizzy: boolean;
  sleepFizzle: boolean;
  dimZap: boolean;
  /** Tetesan: baru saja menyiram tanaman betulan. */
  droplet: boolean;
  /** Percikan: water() di petak tanpa tanaman. */
  splash: boolean;
  status: BotStageStatus;
}

const tileKey = (x: number, y: number) => `${x},${y}`;

/** Hitungan turunan dari keadaan mentah dunia (peti & tanaman). */
function deriveCounts(
  setup: BotWorldSetup,
  boxes: [number, number][],
  wateredPlants: string[],
): Pick<
  BotStageState,
  | 'boxesPlaced'
  | 'boxesTotal'
  | 'boxesStuck'
  | 'allBoxesOnTargets'
  | 'plantsWatered'
  | 'plantsTotal'
  | 'allPlantsWatered'
> {
  const [cols, rows] = setup.gridSize;
  const targetSet = new Set(setup.targets.map(([x, y]) => tileKey(x, y)));
  const plantSet = new Set((setup.plants ?? []).map(([x, y]) => tileKey(x, y)));
  const boxesPlaced = boxes.filter(([x, y]) => targetSet.has(tileKey(x, y))).length;
  const boxesStuck = boxes.some(
    ([x, y]) =>
      (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) &&
      !targetSet.has(tileKey(x, y)),
  );
  const plantsWatered = wateredPlants.filter((k) => plantSet.has(k)).length;
  return {
    boxesPlaced,
    boxesTotal: boxes.length,
    boxesStuck,
    allBoxesOnTargets: boxes.length > 0 && boxesPlaced === boxes.length,
    plantsWatered,
    plantsTotal: plantSet.size,
    allPlantsWatered: plantSet.size > 0 && plantsWatered === plantSet.size,
  };
}

function deriveStatus(s: Omit<BotStageState, 'status'>): BotStageStatus {
  if (!s.awake) return 'asleep';
  if (s.chargedDark && !s.charged) return 'charged-dark';
  if (s.crashed) return 'crashed';
  if (s.charged) return 'charged';
  return 'active';
}

function withStatus(
  s: Omit<BotStageState, 'status'>,
  setup?: BotWorldSetup,
): BotStageState {
  const counts = setup
    ? deriveCounts(setup, s.boxes, s.wateredPlants)
    : {
        boxesPlaced: s.boxesPlaced,
        boxesTotal: s.boxesTotal,
        boxesStuck: s.boxesStuck,
        allBoxesOnTargets: s.allBoxesOnTargets,
        plantsWatered: s.plantsWatered,
        plantsTotal: s.plantsTotal,
        allPlantsWatered: s.allPlantsWatered,
      };
  const merged = { ...s, ...counts };
  return { ...merged, status: deriveStatus(merged) };
}

export function createBotStageState(
  setup: BotWorldSetup,
  startPos: [number, number] = [0, 0],
): BotStageState {
  const [sx, sy] = startPos;
  return withStatus(
    {
      x: sx,
      y: sy,
      facing: setup.startFacing ?? 0,
      awake: false,
      charged: false,
      chargedDark: false,
      crashed: false,
      crashKind: null,
      actedWhileAsleep: false,
      onTarget: setup.targets.some(([tx, ty]) => tx === sx && ty === sy),
      gateOpen: false,
      boxes: (setup.boxes ?? []).map(([x, y]): [number, number] => [x, y]),
      wateredPlants: [],
      waterWasted: 0,
      boxesPlaced: 0,
      boxesTotal: 0,
      boxesStuck: false,
      allBoxesOnTargets: false,
      plantsWatered: 0,
      plantsTotal: 0,
      allPlantsWatered: false,
      dizzy: false,
      sleepFizzle: false,
      dimZap: false,
      droplet: false,
      splash: false,
    },
    setup,
  );
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
  const plantSet = new Set((setup.plants ?? []).map(([x, y]) => `${x},${y}`));
  const onTarget = (x: number, y: number) => targetSet.has(`${x},${y}`);

  return function botStageReducer(
    state: BotStageState,
    action: BotStageAction,
  ): BotStageState {
    switch (action.type) {
      case 'reset':
        return createBotStageState(setup, action.startPos ?? [0, 0]);

      case 'clear-transients':
        if (!state.dizzy && !state.sleepFizzle && !state.dimZap && !state.droplet && !state.splash) {
          return state;
        }
        return withStatus({
          ...state,
          dizzy: false,
          sleepFizzle: false,
          dimZap: false,
          droplet: false,
          splash: false,
        });

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
        if (action.reactionKey === 'plants_dry' || action.reactionKey === 'watered_empty') {
          return withStatus({ ...state, splash: true });
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
          droplet: false,
          splash: false,
        };
        // F-01 berlaku untuk SEMUA aksi tubuh/dunia: robot tertidur tidak
        // bergerak, tidak menyiram, dan tidak menggerakkan pintu air.
        const asleepFizzle = (): BotStageState =>
          withStatus({ ...base, sleepFizzle: true, actedWhileAsleep: true }, setup);
        switch (action.kind) {
          case 'boot':
            return withStatus({ ...base, awake: true }, setup);

          case 'turn-left':
          case 'turn-right': {
            if (!base.awake) return asleepFizzle();
            const delta = action.kind === 'turn-left' ? 3 : 1;
            return withStatus(
              { ...base, facing: ((base.facing + delta) % 4) as Facing },
              setup,
            );
          }

          case 'move': {
            if (!base.awake) return asleepFizzle();
            const steps = normalizeMoveSteps(action.stepsArg);
            const [dx, dy] = DELTAS[base.facing];
            let nx = base.x;
            let ny = base.y;
            let boxes = base.boxes;
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
              // Peti di petak tujuan = DORONG (Q5): peti bergeser satu petak
              // searah hadap bila petak sesudahnya bebas (bukan dinding/batas/
              // peti lain/tanaman). Gagal mendorong = tabrakan biasa: robot
              // berhenti di tempat, peti tidak bergerak.
              const bi = boxes.findIndex(([bx, by]) => bx === tx && by === ty);
              if (bi >= 0) {
                const px = tx + dx;
                const py = ty + dy;
                if (px < 0 || py < 0 || px >= cols || py >= rows) {
                  crashKind = 'bounds';
                  break;
                }
                if (
                  obstacleSet.has(`${px},${py}`) ||
                  plantSet.has(`${px},${py}`) ||
                  boxes.some(([bx, by]) => bx === px && by === py)
                ) {
                  crashKind = 'obstacle';
                  break;
                }
                boxes = boxes.map((b, j): [number, number] =>
                  j === bi ? [px, py] : b,
                );
              }
              nx = tx;
              ny = ty;
            }
            return withStatus(
              {
                ...base,
                x: nx,
                y: ny,
                boxes,
                onTarget: onTarget(nx, ny),
                crashed: base.crashed || crashKind !== null,
                crashKind: base.crashKind ?? crashKind,
                dizzy: crashKind !== null ? true : base.dizzy,
              },
              setup,
            );
          }

          case 'charge': {
            if (!base.awake) return asleepFizzle();
            if (onTarget(base.x, base.y)) {
              return withStatus({ ...base, charged: true }, setup);
            }
            // F-02: charge di tempat gelap = sinyalnya sendiri, BUKAN tabrakan.
            return withStatus({ ...base, chargedDark: true, dimZap: true }, setup);
          }

          case 'water': {
            if (!base.awake) return asleepFizzle();
            // Semantik siram (Q7): tanaman di PETAK ROBOT BERDIRI yang
            // disiram — bukan petak di depannya — supaya pemain cukup
            // melangkah ke petak tanaman lalu menyiram, tanpa menebak
            // arah hadap untuk aksi ini (arah hadap urusan gerak & putar).
            const key = `${base.x},${base.y}`;
            if (plantSet.has(key) && !base.wateredPlants.includes(key)) {
              return withStatus(
                {
                  ...base,
                  wateredPlants: [...base.wateredPlants, key],
                  droplet: true,
                },
                setup,
              );
            }
            // Menyiram petak kosong / tanaman yang sudah basah: percikan
            // percuma — tercatat, tidak menghukum selain waktu animasi.
            return withStatus(
              { ...base, waterWasted: base.waterWasted + 1, splash: true },
              setup,
            );
          }

          case 'open':
          case 'close': {
            if (!base.awake) return asleepFizzle();
            return withStatus(
              { ...base, gateOpen: action.kind === 'open' },
              setup,
            );
          }

          default:
            // Aksi asing: bukan urusan tubuh Piko di panggung ini.
            return withStatus(base, setup);
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
  if (state.allPlantsWatered) return 'Semua tanaman tersiram';
  if (state.plantsTotal > 0) {
    return `Tanaman tersiram: ${state.plantsWatered}/${state.plantsTotal}`;
  }
  if (state.allBoxesOnTargets) return 'Semua peti di tempatnya';
  if (state.boxesTotal > 0) {
    return `Peti di tempatnya: ${state.boxesPlaced}/${state.boxesTotal}`;
  }
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

  // — Quest bertanaman (Q7): sukses = semua tanaman tersiram. Tabrakan di
  // tengah jalan TIDAK menelan hasil siraman (dicek sesudah sukses), sama
  // seperti semangat F-02 — yang dinilai pertama adalah tujuan quest-nya.
  if (state.plantsTotal > 0) {
    if (state.awake && state.allPlantsWatered) return { kind: 'success' };
    if (!state.awake || state.actedWhileAsleep) {
      return { kind: 'fail', reactionKey: pick('wrong_order') };
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
    if (state.waterWasted > 0 && state.plantsWatered === 0) {
      return { kind: 'fail', reactionKey: pick('watered_empty', 'plants_dry') };
    }
    return { kind: 'fail', reactionKey: pick('plants_dry', 'wrong_result') };
  }

  // — Quest berpeti (Q5): sukses = semua peti di petak target. Peti yang
  // terjepit di tepi grid punya leluconnya sendiri (box_stuck).
  if (state.boxesTotal > 0) {
    if (state.awake && state.allBoxesOnTargets) return { kind: 'success' };
    if (!state.awake || state.actedWhileAsleep) {
      return { kind: 'fail', reactionKey: pick('wrong_order') };
    }
    if (state.boxesStuck) {
      return { kind: 'fail', reactionKey: pick('box_stuck', 'boxes_incomplete') };
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
    return { kind: 'fail', reactionKey: pick('boxes_incomplete', 'wrong_result') };
  }

  // — Quest klasik petak cahaya + charge (Q1).
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

/**
 * Periksa keadaan akhir satu skenario terhadap harapannya (Fase 3 Q3).
 * Hanya field yang disebut di `expected` yang dinilai — keadaan parsial.
 */
export function evaluateBotExpectation(
  state: BotStageState,
  expected: BotScenarioExpectation,
): { pass: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (expected.gateOpen !== undefined && state.gateOpen !== expected.gateOpen) {
    mismatches.push('gateOpen');
  }
  if (expected.onTarget !== undefined && state.onTarget !== expected.onTarget) {
    mismatches.push('onTarget');
  }
  if (expected.charged !== undefined && state.charged !== expected.charged) {
    mismatches.push('charged');
  }
  if (
    expected.boxesOnTargets !== undefined &&
    state.allBoxesOnTargets !== expected.boxesOnTargets
  ) {
    mismatches.push('boxesOnTargets');
  }
  if (
    expected.allPlantsWatered !== undefined &&
    state.allPlantsWatered !== expected.allPlantsWatered
  ) {
    mismatches.push('allPlantsWatered');
  }
  if (
    expected.position !== undefined &&
    (state.x !== expected.position[0] || state.y !== expected.position[1])
  ) {
    mismatches.push('position');
  }
  return { pass: mismatches.length === 0, mismatches };
}

/**
 * Turunkan kunci reaksi lucu dari selisih harapan skenario vs keadaan
 * akhir. Urutan: keluarga tertidur → pintu air (dua arah, leluconnya beda:
 * tetap tertutup saat kering vs dibuka saat basah) → peti → tanaman → umum.
 * Konten quest boleh menimpa lewat BotScenario.failReactionKey.
 */
export function botScenarioFailKey(
  state: BotStageState,
  expected: BotScenarioExpectation,
): string {
  if (!state.awake || state.actedWhileAsleep) return 'wrong_order';
  if (expected.gateOpen === true && !state.gateOpen) return 'gate_still_closed';
  if (expected.gateOpen === false && state.gateOpen) return 'opened_when_wet';
  if (expected.boxesOnTargets === true && !state.allBoxesOnTargets) {
    return state.boxesStuck ? 'box_stuck' : 'boxes_incomplete';
  }
  if (expected.allPlantsWatered === true && !state.allPlantsWatered) {
    return state.waterWasted > 0 && state.plantsWatered === 0
      ? 'watered_empty'
      : 'plants_dry';
  }
  if (expected.charged === true && !state.charged) return 'no_charge';
  if (expected.onTarget === true && !state.onTarget) return 'not_on_target';
  return 'wrong_result';
}

/**
 * Kunci reaksi untuk satu babak skenario yang GAGAL harapannya — urutan
 * dahulukan per temuan playtest PT2-F3:
 *
 * 1. Disiplin boot: Piko tidak pernah dinyalakan, atau beraksi selagi
 *    tertidur (`wrong_order`). Penyebab ini yang paling presisi — skrip
 *    tanpa boot() tidak boleh dinarasikan sebagai soal pintu air hanya
 *    karena pintu kebetulan belum bergerak.
 * 2. Tabrakan sungguhan (latch `crashed`): batas grid → `out_of_bounds`,
 *    rintangan → `hit_obstacle`. Pose menceritakan apa yang benar-benar
 *    menghentikan Piko; kunci harapan skenario tetap menelan penyebab
 *    ini bila didahulukan.
 * 3. Kunci tertulis skenario (`failReactionKey`), lalu kunci turunan
 *    dari selisih harapan (`botScenarioFailKey`) — perilaku lama untuk
 *    kegagalan murni soal harapan (pintu salah posisi, peti kurang, dst).
 */
export function resolveScenarioFailKey(
  state: BotStageState,
  scenario: BotScenario,
): string {
  if (!state.awake || state.actedWhileAsleep) return 'wrong_order';
  if (state.crashed) {
    return state.crashKind === 'bounds' ? 'out_of_bounds' : 'hit_obstacle';
  }
  return scenario.failReactionKey ?? botScenarioFailKey(state, scenario.expected);
}

/**
 * Kotak panggung terbesar yang muat di kontainer dengan rasio grid utuh
 * (audit layout B): sel digambar sebagai % dari kotak ini, jadi kotak WAJIB
 * berasio cols:rows — kalau tidak, sel meregang jadi kapsul. Murni, ditest.
 */
export function fitStageBox(
  containerW: number,
  containerH: number,
  cols: number,
  rows: number,
): { width: number; height: number } {
  if (containerW <= 0 || containerH <= 0 || cols <= 0 || rows <= 0) {
    return { width: 0, height: 0 };
  }
  const cell = Math.min(containerW / cols, containerH / rows);
  return { width: cell * cols, height: cell * rows };
}
