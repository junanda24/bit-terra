import type { BotScenario, QuestDefinition, StepEvent } from '../../shared/types';
import {
  createBotApi,
  type BotApiRegistry,
  type BotCallRecord,
} from '../../sandbox/script/BotApiBindings';
import { StepInterpreter } from '../../sandbox/script/StepInterpreter';
import {
  createBotStageReducer,
  createBotStageState,
  evaluateBotExpectation,
  normalizeBotAction,
  type BotStageState,
} from './botStageLogic';

type BotWorldSetup = NonNullable<QuestDefinition['botWorldSetup']>;

/**
 * Pelari bot tanpa kepala (headless): menjalankan kode pemain lewat
 * StepInterpreter ASLI melawan dunia yang disimulasikan oleh reducer
 * botStageLogic yang SAMA dengan yang menggambar BotGridStage — satu
 * sumber semantik untuk animasi, verdict layar, dan pengujian.
 *
 * Dipakai tes integrasi konten (solusi rujukan dibuktikan lulus) dan aman
 * dipakai ulang alat verifikasi lain. Bukan jalur produksi: CyberDeckScreen
 * menganimasikan lewat event bus supaya pemain melihat langkahnya.
 */
export interface BotHeadlessResult {
  /** Keadaan dunia akhir sesudah seluruh skrip jalan (atau berhenti). */
  state: BotStageState;
  /** Panggilan bot yang tercatat registry, urut eksekusi. */
  calls: BotCallRecord[];
  /** Semua StepEvent yang dihasilkan interpreter. */
  events: StepEvent[];
  /** Error ramah bila skrip berhenti di tengah jalan. */
  error?: unknown;
}

export interface BotHeadlessOptions {
  /** Nilai sensor.soilMoisture untuk run ini (bawaan 30, seperti MockBot). */
  soilMoisture?: number;
  /** Posisi awal; bawaan setup.startPos ?? [0, 2] (konvensi CyberDeckScreen). */
  startPos?: [number, number];
}

/**
 * Bangun registry bot yang implementasinya menggerakkan reducer panggung.
 * Objek `gate` dibaca interpreter lewat getter supaya `gate.isOpen` selalu
 * mencerminkan keadaan reducer terkini; objek `sensor` statis per run.
 */
export function createStageDrivenRegistry(
  setup: BotWorldSetup,
  allowed: string[],
  options: BotHeadlessOptions = {},
): { registry: BotApiRegistry; getState: () => BotStageState } {
  const reduce = createBotStageReducer(setup);
  let state = createBotStageState(setup, options.startPos ?? setup.startPos ?? [0, 2]);

  const functions: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of allowed) {
    functions[name] = (...args: unknown[]) => {
      state = reduce(state, {
        type: 'bot',
        kind: normalizeBotAction(name),
        stepsArg: args[0],
      });
      return undefined;
    };
  }

  const gateObject: Record<string, unknown> = {};
  Object.defineProperty(gateObject, 'isOpen', {
    enumerable: true,
    get: () => state.gateOpen,
  });

  const registry = createBotApi(allowed, {
    functions,
    objects: {
      sensor: { soilMoisture: options.soilMoisture ?? 30 },
      gate: gateObject,
    },
  });
  return { registry, getState: () => state };
}

/** Jalankan satu skrip sampai selesai (atau error) melawan dunia panggung. */
export async function runBotHeadless(
  setup: BotWorldSetup,
  allowed: string[],
  code: string,
  options: BotHeadlessOptions = {},
): Promise<BotHeadlessResult> {
  const { registry, getState } = createStageDrivenRegistry(setup, allowed, options);
  const events: StepEvent[] = [];
  let error: unknown;
  try {
    for await (const ev of StepInterpreter.run(code, registry)) {
      events.push(ev);
    }
  } catch (err) {
    error = err;
  }
  return { state: getState(), calls: registry.calls, events, error };
}

/** Hasil satu skenario: keadaan akhir + lulus/gagal menurut harapannya. */
export interface BotScenarioRunResult extends BotHeadlessResult {
  scenario: BotScenario;
  pass: boolean;
  mismatches: string[];
}

/**
 * Jalankan skrip yang sama melawan SEMUA skenario quest (dunia segar per
 * skenario, sensor ditimpa setup skenario) — cermin persis jalur skenario
 * CyberDeckScreen, untuk membuktikan solusi rujukan di tes.
 */
export async function runBotScenariosHeadless(
  quest: QuestDefinition,
  allowed: string[],
  code: string,
): Promise<BotScenarioRunResult[]> {
  const setup = quest.botWorldSetup;
  if (!setup) throw new Error(`Quest ${quest.id} tidak punya botWorldSetup.`);
  const scenarios = quest.botScenarios ?? [];
  const results: BotScenarioRunResult[] = [];
  for (const scenario of scenarios) {
    const run = await runBotHeadless(setup, allowed, code, {
      soilMoisture: scenario.setup.soilMoisture,
    });
    const evaluation = run.error
      ? { pass: false, mismatches: ['error'] }
      : evaluateBotExpectation(run.state, scenario.expected);
    results.push({ ...run, scenario, pass: evaluation.pass, mismatches: evaluation.mismatches });
  }
  return results;
}
