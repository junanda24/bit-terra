import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { LintError, QuestDefinition, SqlRunResult } from '../../shared/types';
import { eventBus } from '../../core/bridge/eventBus';
import { useGameStore } from '../../core/bridge/gameStore';
import { SoundController } from '../../core/audio/SoundController';
import { SqliteWasmRunner } from '../../sandbox/sql/SqliteWasmRunner';
import { SqlAstLinter } from '../../sandbox/sql/SqlAstLinter';
import { ResultDiffChecker } from '../../sandbox/sql/ResultDiffChecker';
import { StepInterpreter } from '../../sandbox/script/StepInterpreter';
import { ScriptLinter } from '../../sandbox/script/ScriptLinter';
import { FriendlyError } from '../../sandbox/script/FriendlyErrorTranslator';
import { createBotApi } from '../../sandbox/script/BotApiBindings';
import { CyberDeckFrame, type LampState } from './CyberDeckFrame';
import { RunLever } from './RunLever';
import { InteractiveEditor } from './InteractiveEditor';
import { SqlTableVisualizer } from '../visualizer/SqlTableVisualizer';
import { BotGridStage, type BotPose } from '../visualizer/BotGridStage';
import { PikoMascotWidget } from '../visualizer/PikoMascotWidget';
import { FocusBar } from '../hud/FocusBar';
import { CartridgeBar } from '../hud/CartridgeBar';
import { DialogueBox } from '../hud/DialogueBox';
import { PixelButton } from '../design-system/PixelButton';

/** Fungsi bot yang dikenal Piko di Fase 1 (gerbang registry BotApiBindings). */
const BASE_BOT_FUNCTIONS = [
  'piko.boot',
  'piko.moveForward',
  'piko.turnLeft',
  'piko.turnRight',
  'piko.charge',
  'gate.open',
  'gate.close',
];

function allowedBotFunctions(quest: QuestDefinition): string[] {
  const set = new Set(BASE_BOT_FUNCTIONS);
  for (const cart of quest.unlockedCartridges) {
    const base = cart.replace(/\(\)\s*$/, '').trim();
    if (base.includes('.')) {
      set.add(base);
    } else if (/^[A-Za-z]+$/.test(base)) {
      set.add(`piko.${base}`);
      set.add(`gate.${base}`);
    }
  }
  return [...set];
}

const NPC_NAMES: Record<string, string> = {
  grandpa_note: 'Catatan Kakek',
  pak_rtani: 'Pak Rani',
  pak_tua_query: 'Pak Tua Query',
  cici_loops: 'Cici Loops',
  bibi_flora: 'Bibi Flora',
  piko: 'Piko',
  kepala_desa: 'Kepala Desa',
};

export function npcDisplayName(giverNpcId: string): string {
  return (
    NPC_NAMES[giverNpcId] ??
    giverNpcId
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

const CONFETTI_COLORS = ['#f4b41b', '#00f5d4', '#c87d55', '#4b724f', '#ffb000'];

export interface CyberDeckScreenProps {
  quest: QuestDefinition;
  onClose?: () => void;
}

/**
 * Layar Cyber-Deck lengkap: komposisi semua komponen UI Fase 1 + otak
 * eksekusinya. Tarik tuas → EXECUTE_CODE → SQL: query dijalankan, dipindai,
 * dicocokkan ResultDiffChecker; Bot: StepInterpreter berjalan baris demi
 * baris dan dunia grid bergerak sinkron. Gagal tidak pernah menakutkan:
 * selalu reaksi lucu dari data quest + Piko yang bicara, fokus −10.
 */
export function CyberDeckScreen({ quest, onClose }: CyberDeckScreenProps) {
  const sayPiko = useGameStore((s) => s.sayPiko);
  const completedQuests = useGameStore((s) => s.completedQuests);
  const isCompleted = completedQuests.includes(quest.id);

  const [code, setCodeState] = useState(
    () => useGameStore.getState().codeByQuest[quest.id] ?? quest.initialCode,
  );
  const [lintErrors, setLintErrors] = useState<LintError[]>([]);
  const [running, setRunning] = useState(false);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [sqlResult, setSqlResult] = useState<SqlRunResult | null>(null);
  const [sourceRows, setSourceRows] = useState<Record<string, unknown>[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [botResetKey, setBotResetKey] = useState(0);

  const codeRef = useRef(code);
  const runningRef = useRef(false);
  const runnerRef = useRef<SqliteWasmRunner | null>(null);
  const schemaRef = useRef<ReturnType<SqliteWasmRunner['getSchema']>>([]);
  const pendingResultRef = useRef<SqlRunResult | null>(null);
  const poseRef = useRef<BotPose | null>(null);
  const crashedRef = useRef(false);
  const runTokenRef = useRef(0);
  const hintIdxRef = useRef(0);

  const isBot = quest.mode === 'BOT_SCRIPT';

  const setCode = useCallback(
    (next: string) => {
      codeRef.current = next;
      setCodeState(next);
      useGameStore.getState().setCode(quest.id, next);
    },
    [quest.id],
  );

  /* ---------------- inisialisasi per quest ---------------- */
  useEffect(() => {
    codeRef.current = useGameStore.getState().codeByQuest[quest.id] ?? quest.initialCode;
    setCodeState(codeRef.current);
    setLintErrors([]);
    setSqlResult(null);
    setSourceRows(null);
    setScanning(false);
    setCurrentLine(null);
    pendingResultRef.current = null;
    poseRef.current = null;
    hintIdxRef.current = 0;
    useGameStore
      .getState()
      .setCurrentQuest(quest.id, quest.mode === 'BOT_SCRIPT' ? 'BOT_SCRIPT' : 'SQL');

    if (quest.mode === 'BOT_SCRIPT') {
      setDbReady(false);
      return;
    }
    const runner = new SqliteWasmRunner();
    runnerRef.current = runner;
    let alive = true;
    runner
      .init(quest.sqlSeedScript ?? '')
      .then(() => {
        if (!alive) return;
        schemaRef.current = runner.getSchema();
        setDbReady(true);
        const first = schemaRef.current[0];
        if (first) {
          try {
            setSourceRows(runner.runQuery(`SELECT * FROM "${first.table}"`).rows);
          } catch {
            setSourceRows(null);
          }
        }
      })
      .catch(() => {
        if (!alive) return;
        setDbReady(false);
        sayPiko(
          'Mesin data Cyber-Deck gagal menyala. Editor tetap bisa dibuka — coba muat ulang halaman ini sebentar lagi.',
          'confused',
        );
      });
    return () => {
      alive = false;
      runner.dispose();
      if (runnerRef.current === runner) runnerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest]);

  /* ---------------- linter real-time (debounce 150ms) ---------------- */
  useEffect(() => {
    const id = window.setTimeout(() => {
      let errors: LintError[] = [];
      try {
        if (isBot) {
          errors = ScriptLinter.lint(code, allowedBotFunctions(quest));
        } else if (schemaRef.current.length > 0) {
          errors = SqlAstLinter.lint(code, schemaRef.current);
        }
      } catch {
        errors = [];
      }
      setLintErrors(errors);
      eventBus.emit('LINTER_STATE', { errors });
    }, 150);
    return () => window.clearTimeout(id);
  }, [code, quest, isBot, dbReady]);

  /* ---------------- jalur selesai ---------------- */
  const successPath = useCallback(() => {
    SoundController.playSFX('success');
    useGameStore.getState().completeQuest(quest.id);
    sayPiko(`Berhasil! Misi "${quest.title}" tuntas. Kerja bagus, Fixer.`, 'happy');
    void confetti({
      particleCount: 110,
      spread: 78,
      origin: { y: 0.55 },
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    });
  }, [quest, sayPiko]);

  const funnyFail = useCallback(
    (reactionKey: string, textOverride?: string) => {
      const reactions = quest.onFailFunnyReactions;
      const text =
        textOverride ??
        reactions[reactionKey] ??
        Object.values(reactions)[0] ??
        'Ada yang belum pas. Tidak apa-apa — justru dari sini belajarnya mulai.';
      SoundController.playSFX('fail');
      eventBus.emit('QUEST_FUNNY_FAIL', { questId: quest.id, reactionKey });
      sayPiko(text, 'shocked');
      useGameStore.getState().adjustFocus(-10);
    },
    [quest, sayPiko],
  );

  /* ---------------- eksekusi SQL ---------------- */
  const finalizeSql = useCallback(() => {
    setScanning(false);
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    runningRef.current = false;
    setRunning(false);
    if (!result) return;
    const expected = quest.expectedSqlResult;
    if (!expected) {
      successPath();
      return;
    }
    const diff = ResultDiffChecker.check(result, expected, {
      orderMatters: /\border\s+by\b/i.test(codeRef.current),
    });
    if (diff.pass) {
      successPath();
      return;
    }
    const expectedCols = Object.keys(expected[0] ?? {}).length;
    const key =
      result.rows.length === 0
        ? 'no_rows'
        : result.rows.length > expected.length
          ? 'too_many_rows'
          : result.columns.length !== expectedCols
            ? 'wrong_column'
            : 'wrong_result';
    funnyFail(key);
  }, [quest, successPath, funnyFail]);

  const runSql = useCallback(() => {
    const runner = runnerRef.current;
    if (!runner || !dbReady) {
      sayPiko(
        'Mesin datanya belum menyala. Tunggu sebentar, atau muat ulang halaman ini.',
        'confused',
      );
      runningRef.current = false;
      setRunning(false);
      return;
    }
    let result: SqlRunResult;
    try {
      result = runner.runQuery(codeRef.current);
    } catch (err) {
      // Error mentah tidak pernah ditampilkan ke pemain (BLUEPRINT §5).
      console.error('[BitTerra] runQuery gagal:', err);
      runningRef.current = false;
      setRunning(false);
      funnyFail('syntax_error');
      return;
    }
    setSqlResult(result);
    eventBus.emit('SQL_RESULT', result);
    pendingResultRef.current = result;
    setScanning(true);
  }, [dbReady, funnyFail, sayPiko]);

  /* ---------------- eksekusi Bot ---------------- */
  const runBot = useCallback(async () => {
    const token = ++runTokenRef.current;
    crashedRef.current = false;
    setBotResetKey((k) => k + 1);
    await sleep(240);
    if (runTokenRef.current !== token) return;
    const registry = createBotApi(allowedBotFunctions(quest), {});
    try {
      for await (const ev of StepInterpreter.run(codeRef.current, registry)) {
        if (runTokenRef.current !== token) return;
        setCurrentLine(ev.line);
        eventBus.emit('STEP_HIGHLIGHT', { line: ev.line });
        if (ev.kind === 'call' && ev.action) {
          eventBus.emit('BOT_ACTION', {
            action: ev.action,
            args: ev.args ?? [],
            line: ev.line,
          });
          await sleep(430);
        } else if (ev.kind !== 'done') {
          await sleep(80);
        }
      }
    } catch (err) {
      if (err instanceof FriendlyError) {
        funnyFail('interpreter_error', err.message);
      } else {
        console.error('[BitTerra] StepInterpreter gagal:', err);
        funnyFail(
          'interpreter_error',
          'Piko berhenti di tengah jalan dan menggaruk antenanya. Ada perintah yang belum ia mengerti — periksa lagi barisnya pelan-pelan.',
        );
      }
      return;
    } finally {
      setCurrentLine(null);
      eventBus.emit('STEP_HIGHLIGHT', { line: null });
      runningRef.current = false;
      setRunning(false);
    }
    await sleep(140);
    const pose = poseRef.current;
    const targets = quest.botWorldSetup?.targets ?? [];
    if (targets.length === 0 || !pose) {
      successPath();
      return;
    }
    if (pose.awake && pose.onTarget && pose.charged) {
      successPath();
      return;
    }
    const reactions = quest.onFailFunnyReactions;
    let key = 'wrong_result';
    if (!pose.awake && 'wrong_order' in reactions) key = 'wrong_order';
    else if (crashedRef.current && 'hit_obstacle' in reactions) key = 'hit_obstacle';
    else if (crashedRef.current && 'out_of_bounds' in reactions) key = 'out_of_bounds';
    else if (pose.onTarget && !pose.charged && 'no_charge' in reactions) key = 'no_charge';
    else if ('out_of_bounds' in reactions) key = 'out_of_bounds';
    funnyFail(key);
  }, [quest, funnyFail, successPath]);

  /* ---------------- gerbang eksekusi ---------------- */
  const execute = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    if (isBot) {
      void runBot();
    } else {
      runSql();
    }
  }, [isBot, runBot, runSql]);

  const executeRef = useRef(execute);
  executeRef.current = execute;

  useEffect(() => {
    const handler = ({ questId }: { questId: string }) => {
      if (questId === quest.id) executeRef.current();
    };
    eventBus.on('EXECUTE_CODE', handler);
    return () => {
      eventBus.off('EXECUTE_CODE', handler);
    };
  }, [quest.id]);

  /* ---------------- interaksi UI ---------------- */
  const handleInsert = useCallback(
    (snippet: string) => {
      const cur = codeRef.current;
      const sep = cur === '' || cur.endsWith('\n') ? '' : '\n';
      const tail = snippet.endsWith(';') || snippet.endsWith('}') ? '\n' : '';
      setCode(cur + sep + snippet + tail);
    },
    [setCode],
  );

  const handleHint = useCallback(() => {
    const idx = hintIdxRef.current % quest.hints.length;
    hintIdxRef.current += 1;
    sayPiko(quest.hints[idx], 'normal');
  }, [quest, sayPiko]);

  const lampState: LampState = running ? 'running' : lintErrors.length > 0 ? 'error' : 'ready';

  const stickers = completedQuests.map((id, i) => {
    const m = /quest_(\d+)/.exec(id);
    return {
      label: m ? `Misi ${m[1]}` : 'Misi',
      color: ['#f4b41b', '#00f5d4', '#c87d55', '#4b724f'][i % 4],
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      {/* Kepala misi */}
      <header className="flex flex-wrap items-center gap-3">
        <h1
          className="text-[15px] tracking-[0.08em]"
          style={{ fontFamily: "'Press Start 2P', monospace", color: '#ffb000' }}
        >
          {quest.title}
        </h1>
        <span
          className="rounded-[3px] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider"
          style={{
            fontFamily: "'Pixelify Sans', sans-serif",
            backgroundColor: isBot ? '#c87d55' : '#3b82a6',
            color: '#fff7ea',
            border: '1.5px solid rgba(0,0,0,0.5)',
          }}
        >
          {isBot ? 'Program Bot' : 'Query SQL'}
        </span>
        <span
          className="text-[13px] font-semibold uppercase tracking-[0.14em]"
          style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
        >
          Babak {quest.act} · {quest.difficulty}
        </span>
        {isCompleted ? (
          <span
            className="rounded-[3px] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider"
            style={{
              fontFamily: "'Pixelify Sans', sans-serif",
              backgroundColor: '#f4b41b',
              color: '#141820',
              border: '1.5px solid rgba(0,0,0,0.5)',
            }}
          >
            Misi selesai
          </span>
        ) : null}
        {onClose ? (
          <span className="ml-auto">
            <PixelButton variant="slate" onClick={onClose}>
              Tutup Deck
            </PixelButton>
          </span>
        ) : null}
      </header>

      <DialogueBox name={npcDisplayName(quest.giverNpcId)} text={quest.storyContext} />
      <p
        className="-mt-1 text-[15px]"
        style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#d8ccb8' }}
      >
        <b style={{ color: '#f4b41b' }}>Tujuan:</b> {quest.objectiveText}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Kolom pendamping */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          <PikoMascotWidget />
          <FocusBar />
          <div className="flex flex-wrap gap-2">
            <PixelButton variant="moss" onClick={handleHint}>
              Minta Petunjuk
            </PixelButton>
            <PixelButton variant="slate" onClick={() => setCode(quest.initialCode)}>
              Ulangi Kode Awal
            </PixelButton>
          </div>
          {lintErrors.length > 0 ? (
            <div
              className="rounded-[4px] px-3 py-2"
              style={{
                backgroundColor: 'rgba(255,77,109,0.1)',
                border: '2px solid rgba(255,77,109,0.45)',
              }}
            >
              <p
                className="mb-1 text-[12px] font-bold uppercase tracking-[0.16em]"
                style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#ff8fa5' }}
              >
                Catatan Piko
              </p>
              <ul
                className="space-y-1 text-[13.5px] leading-snug"
                style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#f2ead6' }}
              >
                {lintErrors.slice(0, 3).map((e, i) => (
                  <li key={i}>
                    Baris {e.line}: {e.message}
                    {e.suggestion ? (
                      <span style={{ color: '#00f5d4' }}> {e.suggestion}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* Deck */}
        <div className="min-w-0 flex-1">
          <CyberDeckFrame
            title="CYBER-DECK"
            lampState={lampState}
            stickers={stickers}
            rightRail={<RunLever questId={quest.id} disabled={running} />}
          >
            <div className="flex h-[600px] flex-col">
              <div
                className="shrink-0 border-b-2"
                style={{ borderColor: 'rgba(216,204,184,0.14)', backgroundColor: '#10131a' }}
              >
                <CartridgeBar
                  cartridges={quest.unlockedCartridges}
                  onInsert={handleInsert}
                  disabled={running}
                />
              </div>
              {isBot && quest.botWorldSetup ? (
                <div className="flex min-h-0 flex-1">
                  <div className="w-[38%] min-w-[240px] shrink-0">
                    <InteractiveEditor
                      value={code}
                      onChange={setCode}
                      mode="BOT_SCRIPT"
                      lintErrors={lintErrors}
                      currentLine={currentLine}
                      readOnly={running}
                    />
                  </div>
                  <div
                    className="min-w-0 flex-1 border-l-2"
                    style={{ borderColor: 'rgba(216,204,184,0.14)' }}
                  >
                    <BotGridStage
                      setup={quest.botWorldSetup}
                      startPos={[0, 2]}
                      resetKey={botResetKey}
                      onPoseChange={(pose) => {
                        poseRef.current = pose;
                        if (pose.dizzy) crashedRef.current = true;
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-[180px] flex-1">
                    <InteractiveEditor
                      value={code}
                      onChange={setCode}
                      mode="SQL"
                      lintErrors={lintErrors}
                      currentLine={currentLine}
                      readOnly={running}
                    />
                  </div>
                  <div
                    className="h-[248px] shrink-0 border-t-2"
                    style={{ borderColor: 'rgba(216,204,184,0.14)' }}
                  >
                    <SqlTableVisualizer
                      result={sqlResult}
                      sourceRows={sourceRows}
                      scanning={scanning}
                      onScanComplete={finalizeSql}
                    />
                  </div>
                </div>
              )}
            </div>
          </CyberDeckFrame>
        </div>
      </div>
    </div>
  );
}

export default CyberDeckScreen;
