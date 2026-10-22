import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { LintError, QuestDefinition, SqlRunResult } from '../../shared/types';
import { eventBus } from '../../core/bridge/eventBus';
import { useGameStore } from '../../core/bridge/gameStore';
import { SoundController } from '../../core/audio/SoundController';
import { SqliteWasmRunner } from '../../sandbox/sql/SqliteWasmRunner';
import { SqlAstLinter } from '../../sandbox/sql/SqlAstLinter';
import {
  executeGuardedSql,
  SQL_ROLLBACK_NARRATION,
} from '../../sandbox/sql/SqlStatementGuard';
import { classifySqlRuntimeError } from '../../sandbox/sql/SqlRuntimeError';
import { ResultDiffChecker } from '../../sandbox/sql/ResultDiffChecker';
import { StepInterpreter } from '../../sandbox/script/StepInterpreter';
import { ScriptLinter } from '../../sandbox/script/ScriptLinter';
import { FriendlyError } from '../../sandbox/script/FriendlyErrorTranslator';
import { createBotApi } from '../../sandbox/script/BotApiBindings';
import { logError } from '../../app/errorLog';
import { nextStepWithTimeout, STEP_WATCHDOG_MS } from './stepWatchdog';
import { CyberDeckFrame, type LampState } from './CyberDeckFrame';
import { RunLever } from './RunLever';
import { InteractiveEditor, type InteractiveEditorHandle } from './InteractiveEditor';
import { SqlTableVisualizer } from '../visualizer/SqlTableVisualizer';
import { BotGridStage, type BotPose } from '../visualizer/BotGridStage';
import { botQuestVerdict } from '../visualizer/botStageLogic';
import { PikoMascotWidget } from '../visualizer/PikoMascotWidget';
import { FocusBar } from '../hud/FocusBar';
import { CartridgeBar } from '../hud/CartridgeBar';
import { getCartridgeSnippet } from '../hud/cartridgeSnippets';
import { DialogueBox } from '../hud/DialogueBox';
import { PixelButton } from '../design-system/PixelButton';
import {
  getQuestDialogue,
  type DialogueLine,
} from '../../content/dialogues/q1_q2_dialogues';
import {
  FOCUS_FAIL_COST,
  FOCUS_SUCCESS_REWARD,
  shouldDeductFocusOnFail,
} from './focusPolicy';
import { humanizeWorldEvent, summarizeLintErrors } from './dialogueHelpers';

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
    // Sumber kebenaran pemilik fungsi adalah SNIPPET cartridge itu sendiri:
    // 'boot()' → "piko.boot();", 'open()' → "gate.open();". Dulu nama polos
    // diperluas ke piko.* DAN gate.* sekaligus, sehingga daftar modul Piko
    // tercemar kombinasi karangan seperti "gate.charge" (temuan F-10).
    const snippetHead = /^([A-Za-z]+(?:\.[A-Za-z]+)+)\s*\(/.exec(
      getCartridgeSnippet(cart).trim(),
    );
    if (snippetHead) {
      set.add(snippetHead[1]);
      continue;
    }
    const base = cart.replace(/\(\)\s*$/, '').trim();
    if (base.includes('.')) {
      set.add(base);
    } else if (/^[A-Za-z]+$/.test(base)) {
      set.add(`piko.${base}`);
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

/** Query SQL di atas ambang ini dicatat ke error log (BLUEPRINT §7). */
const SLOW_QUERY_LOG_MS = 2_000;

export interface CyberDeckScreenProps {
  quest: QuestDefinition;
  onClose?: () => void;
  /** Status musik latar (header tunggal audit layout D menggabungkan chrome App). */
  musicOn?: boolean;
  onToggleMusic?: () => void;
}

/**
 * Layar Cyber-Deck lengkap: komposisi semua komponen UI Fase 1 + otak
 * eksekusinya. Tarik tuas → gerbang linter dulu (RUN tidak pernah membuang
 * diagnosis linter, F-07) → SQL: query dijalankan, dipindai, dicocokkan
 * ResultDiffChecker; Bot: StepInterpreter berjalan baris demi baris dan
 * dunia grid bergerak sinkron, verdict dari botQuestVerdict (urutan boot
 * ditegakkan dunia, F-01/F-02). Gagal tidak pernah menakutkan: reaksi lucu
 * dari data quest + dialog hasil karya penulis + Piko yang bicara (F-03).
 * Fokus hanya dipotong untuk kesalahan konsep yang lolos linter pada kode
 * yang sudah diubah pemain (F-04/F-09); quest tuntas mengisinya kembali.
 */
export function CyberDeckScreen({ quest, onClose, musicOn = false, onToggleMusic }: CyberDeckScreenProps) {
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
  const [engineFailed, setEngineFailed] = useState(false);
  const [botResetKey, setBotResetKey] = useState(0);
  // Urutan dialog hasil karya penulis (intro / sukses / funnyFail) yang
  // sedang diputar di overlay dialog (F-03). Intro tampil sebagai modal
  // pembuka; dialog cerita lain sebagai bilah bawah tanpa backdrop
  // (audit layout + koreksi ui-ux: jangan modal-kan funny-fail).
  const [dialogue, setDialogue] = useState<{ lines: DialogueLine[]; idx: number } | null>(null);
  const [dialogueLineDone, setDialogueLineDone] = useState(false);
  const [dialogueKind, setDialogueKind] = useState<'intro' | 'story'>('story');
  const [introSeen, setIntroSeen] = useState(false);
  // Panel pendamping bertab (audit layout): Cerita | Cek Kode; di layar
  // kecil kolom kiri & deck bergantian lewat tab mobile.
  const [sideTab, setSideTab] = useState<'cerita' | 'kode'>('cerita');
  const [mobileTab, setMobileTab] = useState<'deck' | 'piko'>('deck');

  const codeRef = useRef(code);
  const runningRef = useRef(false);
  const runnerRef = useRef<SqliteWasmRunner | null>(null);
  const schemaRef = useRef<ReturnType<SqliteWasmRunner['getSchema']>>([]);
  const pendingResultRef = useRef<SqlRunResult | null>(null);
  // Run SQL terakhir mengandung statement tulis di quest baca-saja
  // (SQL-H1): efeknya sudah di-rollback; finalizeSql wajib memblokir
  // penyelesaian dan mengucapkan narasi rollback, bukan verdict biasa.
  const pendingContaminatedRef = useRef(false);
  const poseRef = useRef<BotPose | null>(null);
  const runTokenRef = useRef(0);
  const hintIdxRef = useRef(0);
  const linterWarnedRef = useRef(false);
  // Snapshot keputusan fokus untuk run yang sedang berjalan (F-04/F-09):
  // dihitung sekali di gerbang eksekusi dari kode + status linter saat RUN.
  const deductFocusRef = useRef(false);
  const editorRef = useRef<InteractiveEditorHandle | null>(null);
  const experimentNotedRef = useRef(false);

  const isBot = quest.mode === 'BOT_SCRIPT';

  const setCode = useCallback(
    (next: string) => {
      codeRef.current = next;
      setCodeState(next);
      useGameStore.getState().setCode(quest.id, next);
    },
    [quest.id],
  );

  /* ---------------- urutan dialog (F-03) ---------------- */
  const startDialogue = useCallback(
    (lines: DialogueLine[] | undefined, kind: 'intro' | 'story' = 'story') => {
      if (!lines || lines.length === 0) return;
      setDialogueKind(kind);
      setDialogue({ lines, idx: 0 });
      setDialogueLineDone(false);
    },
    [],
  );

  const advanceDialogue = useCallback(() => {
    setDialogueLineDone(false);
    setDialogue((d) => {
      if (!d) return d;
      if (d.idx + 1 >= d.lines.length) {
        // Dialog pembuka selesai dibaca → chip "Putar Ulang Pembuka" muncul.
        if (dialogueKind === 'intro') setIntroSeen(true);
        return null;
      }
      return { ...d, idx: d.idx + 1 };
    });
  }, [dialogueKind]);

  const replayIntro = useCallback(() => {
    startDialogue(getQuestDialogue(quest.id, 'intro'), 'intro');
  }, [quest.id, startDialogue]);

  /* ---------------- inisialisasi mesin SQL ---------------- */
  // Segarkan baris sumber scanner dari keadaan DB SAAT INI (SQL-M2):
  // tabel yang dipindai ditentukan quest (sqlSourceTable), bukan sekadar
  // tabel pertama menurut abjad; dipanggil ulang sesudah setiap run
  // (post-rollback) supaya yang tampil selalu keadaan sebenarnya.
  const refreshSourceRows = useCallback(
    (runner: SqliteWasmRunner) => {
      try {
        const schema = runner.getSchema();
        const wanted = quest.sqlSourceTable?.toLowerCase();
        const entry =
          (wanted
            ? schema.find((t) => t.table.toLowerCase() === wanted)
            : undefined) ?? schema[0];
        if (!entry) {
          setSourceRows(null);
          return;
        }
        setSourceRows(runner.runQuery(`SELECT * FROM "${entry.table}"`).rows);
      } catch {
        setSourceRows(null);
      }
    },
    [quest.sqlSourceTable],
  );

  // Dipisah dari effect agar tombol "Coba Lagi" bisa menyalakan ulang mesin
  // yang sama. Kegagalan = mode degradasi yang jujur (BLUEPRINT §7): editor
  // tetap bisa dipakai, RUN menjelaskan, tidak pernah layar kosong/hang.
  const startEngine = useCallback(() => {
    runnerRef.current?.dispose();
    const runner = new SqliteWasmRunner();
    runnerRef.current = runner;
    setEngineFailed(false);
    setDbReady(false);
    runner
      .init(quest.sqlSeedScript ?? '')
      .then(() => {
        if (runnerRef.current !== runner) return;
        schemaRef.current = runner.getSchema();
        setDbReady(true);
        refreshSourceRows(runner);
      })
      .catch((err: unknown) => {
        if (runnerRef.current !== runner) return;
        console.error('[BitTerra] Mesin SQL gagal menyala:', err);
        logError(err, 'sql-init');
        setEngineFailed(true);
        setDbReady(false);
        sayPiko(
          'Mesin data Piko gagal menyala. Editor tetap bisa kamu pakai untuk menulis query — tekan tombol "Coba Nyalakan Mesin Data" di samping Piko untuk mencoba menyalakannya lagi.',
          'confused',
        );
      });
  }, [quest, sayPiko, refreshSourceRows]);

  /* ---------------- inisialisasi per quest ---------------- */
  useEffect(() => {
    codeRef.current = useGameStore.getState().codeByQuest[quest.id] ?? quest.initialCode;
    setCodeState(codeRef.current);
    setLintErrors([]);
    setSqlResult(null);
    setSourceRows(null);
    setScanning(false);
    setCurrentLine(null);
    setEngineFailed(false);
    linterWarnedRef.current = false;
    pendingResultRef.current = null;
    pendingContaminatedRef.current = false;
    poseRef.current = null;
    hintIdxRef.current = 0;
    deductFocusRef.current = false;
    experimentNotedRef.current = false;
    setDialogue(null);
    setDialogueLineDone(false);
    setIntroSeen(false);
    setSideTab('cerita');
    setMobileTab('deck');
    // Dialog intro hasil karya penulis diputar sebagai MODAL pembuka saat
    // deck quest dibuka (surat Kakek untuk Q1, kepanikan Pak Rani untuk
    // Q2) — F-03 + audit layout (CATATAN KAKEK tidak lagi memakan ruang
    // permanen di atas layar).
    startDialogue(getQuestDialogue(quest.id, 'intro'), 'intro');
    useGameStore
      .getState()
      .setCurrentQuest(quest.id, quest.mode === 'BOT_SCRIPT' ? 'BOT_SCRIPT' : 'SQL');

    if (quest.mode === 'BOT_SCRIPT') {
      setDbReady(false);
      return;
    }
    startEngine();
    return () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    };
  }, [quest, startEngine]);

  /* ---------------- linter ---------------- */
  // Satu-satunya penghitung lint — dipakai panel real-time (debounce) DAN
  // gerbang RUN, supaya keduanya tidak pernah berbeda pendapat (F-07).
  const runLint = useCallback(
    (codeToLint: string): LintError[] => {
      try {
        if (isBot) {
          return ScriptLinter.lint(codeToLint, allowedBotFunctions(quest));
        }
        if (schemaRef.current.length > 0) {
          return SqlAstLinter.lint(codeToLint, schemaRef.current);
        }
        return [];
      } catch (err) {
        // Linter yang macet tidak boleh berpura-pura kode bersih: catat ke
        // log dan beri tahu pemain satu kali bahwa catatan otomatis sedang
        // berhenti, sementara RUN tetap bisa dipakai (BLUEPRINT §7).
        console.error('[BitTerra] Linter gagal berjalan:', err);
        logError(err, 'linter');
        if (!linterWarnedRef.current) {
          linterWarnedRef.current = true;
          sayPiko(
            'Catatan otomatis Piko sedang macet, jadi periksa kodemu pelan-pelan ya. Tombol RUN tetap bisa dipakai.',
            'confused',
          );
        }
        return [];
      }
    },
    [isBot, quest, sayPiko],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      const errors = runLint(code);
      setLintErrors(errors);
      eventBus.emit('LINTER_STATE', { errors });
    }, 150);
    return () => window.clearTimeout(id);
  }, [code, runLint, dbReady]);

  // Panel pendamping berpindah sendiri ke tab Cek Kode begitu ada catatan
  // linter — pemain tidak perlu berburu pesan error (audit layout).
  useEffect(() => {
    if (lintErrors.length > 0) setSideTab('kode');
  }, [lintErrors]);

  /* ---------------- jalur selesai ---------------- */
  const successPath = useCallback(() => {
    SoundController.playSFX('success');
    // completeQuest reports whether THIS run is the quest's first
    // completion; the +20 refill is a completion reward, so it is granted
    // only then — re-running a solved quest must not farm focus (CORE-H1).
    const firstCompletion = useGameStore.getState().completeQuest(quest.id);
    // Quest tuntas = istirahat yang terbayar: fokus pulih (F-04).
    if (firstCompletion) {
      useGameStore.getState().adjustFocus(FOCUS_SUCCESS_REWARD);
    }
    sayPiko(`Berhasil! Misi "${quest.title}" tuntas. Kerja bagus, Fixer.`, 'happy');
    // Dialog sukses hasil karya penulis + perubahan dunia yang tadinya
    // data mati — sekarang benar-benar tampil ke pemain (F-03).
    const lines: DialogueLine[] = [...(getQuestDialogue(quest.id, 'success') ?? [])];
    if (quest.onSuccessWorldEvents.length > 0) {
      lines.push({
        speaker: 'Perubahan di desa',
        text: quest.onSuccessWorldEvents.map(humanizeWorldEvent).join(' · '),
      });
    }
    startDialogue(lines);
    void confetti({
      particleCount: 110,
      spread: 78,
      origin: { y: 0.55 },
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    });
  }, [quest, sayPiko, startDialogue]);

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
      // Baris funnyFail hasil karya penulis menyusul reaksi Piko (F-03).
      startDialogue(getQuestDialogue(quest.id, 'funnyFail'));
      // Potongan fokus hanya bila snapshot gerbang RUN mengizinkan:
      // kode sudah diubah pemain + linter bersih saat RUN (F-04/F-09).
      if (deductFocusRef.current) {
        useGameStore.getState().adjustFocus(-FOCUS_FAIL_COST);
      }
    },
    [quest, sayPiko, startDialogue],
  );

  /* ---------------- eksekusi SQL ---------------- */
  const finalizeSql = useCallback(() => {
    setScanning(false);
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    const contaminated = pendingContaminatedRef.current;
    pendingContaminatedRef.current = false;
    runningRef.current = false;
    setRunning(false);
    if (!result) return;
    // Run terkontaminasi statement tulis (SQL-H1): penyelesaian DIBLOKIR
    // apa pun hasil diff-nya — jawaban quest baca-saja harus murni SELECT.
    // Eksperimen pemain tidak dipajaki fokus; Piko menjelaskan rollback-nya.
    if (contaminated) {
      deductFocusRef.current = false;
      funnyFail('rolled_back', SQL_ROLLBACK_NARRATION);
      return;
    }
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
    // Pemilihan kunci reaksi (F-05/F-06): bentuk hitungan murni memakai
    // no_rows / too_many_rows; kolom yang tidak pas memakai wrong_column
    // (teksnya kini netral arah — kelebihan maupun kekurangan kolom);
    // sisanya = kolom benar tetapi ISI baris tidak cocok → wrong_result.
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
        engineFailed
          ? 'Mesin data Piko gagal menyala, jadi query belum bisa dijalankan. Tekan tombol "Coba Nyalakan Mesin Data" di samping Piko untuk mencoba lagi.'
          : 'Mesin datanya belum menyala. Tunggu sebentar, atau muat ulang halaman ini.',
        'confused',
      );
      runningRef.current = false;
      setRunning(false);
      return;
    }
    let result: SqlRunResult;
    let contaminated = false;
    const startedAt = performance.now();
    try {
      // Eksekusi terbungkus penjaga statement (SQL-H1): quest baca-saja
      // berjalan di atas snapshot; efek tulis terlihat di hasil pindaian,
      // lalu DB dipulihkan (auto-rollback) sebelum verdict dihitung.
      const outcome = executeGuardedSql(
        runner,
        codeRef.current,
        quest.sqlWritesAllowed === true,
      );
      result = outcome.result;
      contaminated = outcome.contaminated;
    } catch (err) {
      // Error runtime diklasifikasikan dulu (SQL-M1): narasinya menyebut
      // kelas masalah yang sebenarnya (fungsi tak dikenal, agregat di
      // WHERE, ...), bukan "salah sintaks" generik — dan kelas ini tidak
      // dipajaki fokus, sesuai kebijakan memaafkan F-04/F-09. Error mentah
      // tidak pernah ditampilkan ke pemain (BLUEPRINT §5).
      console.error('[BitTerra] runQuery gagal:', err);
      runningRef.current = false;
      setRunning(false);
      refreshSourceRows(runner);
      deductFocusRef.current = false;
      funnyFail('syntax_error', classifySqlRuntimeError(err).narration);
      return;
    }
    // runQuery sinkron, jadi tidak ada watchdog async yang jujur untuknya —
    // yang bisa dilakukan: ukur durasinya dan catat query yang lambat ke
    // error log agar terlihat di panel Periksa Kesehatan (BLUEPRINT §7).
    const elapsedMs = performance.now() - startedAt;
    if (elapsedMs > SLOW_QUERY_LOG_MS) {
      console.error(`[BitTerra] Query SQL lambat: ${elapsedMs.toFixed(0)}ms`);
      logError(
        new Error(
          `Query SQL lambat: ${elapsedMs.toFixed(0)}ms (ambang ${SLOW_QUERY_LOG_MS}ms), quest ${quest.id}.`,
        ),
        'sql-slow-query',
      );
    }
    // Scanner menampilkan keadaan DB sesudah run (post-rollback) — jujur
    // terhadap apa yang benar-benar tersimpan sekarang (SQL-M2).
    refreshSourceRows(runner);
    pendingContaminatedRef.current = contaminated;
    setSqlResult(result);
    eventBus.emit('SQL_RESULT', result);
    pendingResultRef.current = result;
    setScanning(true);
  }, [dbReady, engineFailed, funnyFail, quest, refreshSourceRows, sayPiko]);

  /* ---------------- eksekusi Bot ---------------- */
  const runBot = useCallback(async () => {
    const token = ++runTokenRef.current;
    setBotResetKey((k) => k + 1);
    await sleep(240);
    if (runTokenRef.current !== token) return;
    const registry = createBotApi(allowedBotFunctions(quest), {});
    const iterator = StepInterpreter.run(codeRef.current, registry);
    let watchdogStopped = false;
    try {
      for (;;) {
        if (runTokenRef.current !== token) {
          void iterator.return(undefined).catch(() => undefined);
          return;
        }
        // Watchdog (BLUEPRINT §7): kalau satu langkah tidak kunjung datang
        // (await patologis di interpreter), hentikan larian dengan bersih
        // daripada membiarkan tuas RUN terkunci selamanya. Loop sinkron
        // tak hingga sudah dibatasi LoopGuard 500 di interpreter.
        const outcome = await nextStepWithTimeout(iterator.next(), STEP_WATCHDOG_MS);
        if (outcome.timeout) {
          watchdogStopped = true;
          console.error(
            `[BitTerra] Watchdog: eksekusi bot dihentikan — ${STEP_WATCHDOG_MS}ms tanpa StepEvent.`,
          );
          logError(
            new Error(
              `Watchdog menghentikan eksekusi bot quest ${quest.id}: tidak ada StepEvent selama ${STEP_WATCHDOG_MS}ms.`,
            ),
            'watchdog',
          );
          void iterator.return(undefined).catch(() => undefined);
          break;
        }
        if (outcome.result.done) break;
        const ev = outcome.result.value;
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
        // Pesan + saran ikut tampil — diagnosis tidak boleh terpotong (F-07).
        funnyFail(
          'interpreter_error',
          err.suggestion ? `${err.message} ${err.suggestion}` : err.message,
        );
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
    if (watchdogStopped) {
      // Penghentian oleh sistem, BUKAN kesalahan pemain: fokus tidak
      // dikurangi, tidak ada reaksi gagal — Piko menjelaskan dengan jujur.
      sayPiko(
        'Piko menghentikan jalannya program karena terlalu lama tidak ada langkah baru. Ini bukan salahmu — coba jalankan lagi; catatannya sudah tersimpan di log error.',
        'confused',
      );
      return;
    }
    await sleep(140);
    const pose = poseRef.current;
    const targets = quest.botWorldSetup?.targets ?? [];
    if (targets.length === 0 || !pose) {
      successPath();
      return;
    }
    // Verdict murni dari pose akhir dunia (botStageLogic): urutan boot
    // ditegakkan oleh panggung (aksi saat tertidur fizzle), tabrakan adalah
    // latch per run dari kejadian tabrak sungguhan, dan charge di tempat
    // gelap punya kuncinya sendiri — tidak ada lagi rantai if yang menelan
    // semua kegagalan menjadi "tabrakan" (F-01/F-02).
    const verdict = botQuestVerdict(pose, quest.onFailFunnyReactions);
    if (verdict.kind === 'success') {
      successPath();
      return;
    }
    funnyFail(verdict.reactionKey);
  }, [quest, funnyFail, successPath, sayPiko]);

  /* ---------------- gerbang eksekusi ---------------- */
  const execute = useCallback(() => {
    if (runningRef.current) return;
    // Gerbang linter (F-07): RUN menghormati diagnosis linter. Bila masih
    // ada error, TIDAK ada eksekusi dan TIDAK ada potongan fokus — Piko
    // menyampaikan diagnosis PERTAMA persis dari linter (pesan + saran),
    // bukan teks generik yang lebih buruk dari yang sudah dilihat pemain.
    const freshLint = runLint(codeRef.current);
    setLintErrors(freshLint);
    eventBus.emit('LINTER_STATE', { errors: freshLint });
    if (freshLint.length > 0) {
      const first = freshLint[0];
      sayPiko(
        first.suggestion ? `${first.message} ${first.suggestion}` : first.message,
        'confused',
      );
      return;
    }
    // Snapshot kebijakan fokus untuk run ini (F-04/F-09).
    deductFocusRef.current = shouldDeductFocusOnFail({
      code: codeRef.current,
      initialCode: quest.initialCode,
      lintErrors: freshLint,
    });
    runningRef.current = true;
    setRunning(true);
    if (isBot) {
      void runBot();
    } else {
      runSql();
    }
  }, [isBot, runBot, runSql, runLint, quest.initialCode, sayPiko]);

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
      // Quest yang sudah tuntas tidak dikunci lagi — tetapi pemain diberi
      // tahu bahwa sisipan ini murni eksperimen (F-08 lanjutan).
      if (isCompleted && !experimentNotedRef.current) {
        experimentNotedRef.current = true;
        sayPiko(
          'Quest ini sudah selesai — kode diubah untuk eksperimen. Catatan selesainya tetap aman, jadi silakan utak-atik sepuasnya.',
          'normal',
        );
      }
      // Jalur utama: sisipkan TEPAT di kursor lewat handle imperatif editor
      // (F-08 — dulu selalu menempel di akhir dokumen dan merusak semantik).
      if (editorRef.current?.insertAtCursor(snippet)) return;
      // Cadangan (editor belum ter-mount): tempel di akhir seperti dulu.
      const cur = codeRef.current;
      const sep = cur === '' || cur.endsWith('\n') ? '' : '\n';
      const tail = snippet.endsWith(';') || snippet.endsWith('}') ? '\n' : '';
      setCode(cur + sep + snippet + tail);
    },
    [setCode, isCompleted, sayPiko],
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

  // Panel CATATAN PIKO menampilkan ringkasan: blanko digabung jadi satu
  // baris (audit layout F), error lain apa adanya.
  const lintItems = summarizeLintErrors(lintErrors);

  return (
    <div className="bt-deck-root relative flex h-full min-h-0 w-full flex-col gap-3 p-4">
      {/* Header tunggal (audit layout D): kembali + judul misi + musik dalam
          SATU baris — dulu chrome bertumpuk 4 lapis ±282–382px. */}
      <header className="flex h-14 shrink-0 flex-wrap items-center gap-3">
        {onClose ? (
          <PixelButton variant="slate" onClick={onClose}>
            Kembali ke Daftar Quest
          </PixelButton>
        ) : null}
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
            color: isBot ? '#141820' : '#0a0e14',
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
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {introSeen && !dialogue ? (
            <PixelButton variant="copper" onClick={replayIntro}>
              Putar Ulang Pembuka
            </PixelButton>
          ) : null}
          {onToggleMusic ? (
            <PixelButton variant="slate" onClick={() => void onToggleMusic()}>
              {musicOn ? 'Musik: Nyala' : 'Musik: Mati'}
            </PixelButton>
          ) : null}
        </span>
      </header>

      {/* Banner tujuan ringkas: satu baris, terpotong rapi, kolaps di
          viewport pendek (lihat index.css .bt-objective). */}
      <p
        className="bt-objective shrink-0 truncate text-[15px]"
        title={quest.objectiveText}
        style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#d8ccb8' }}
      >
        <b style={{ color: '#f4b41b' }}>Tujuan:</b> {quest.objectiveText}
      </p>

      {/* Tab panel layar kecil: deck & pendamping bergantian tampil —
          keduanya tetap ter-mount agar state editor/dunia tidak hilang. */}
      <div
        className="flex shrink-0 gap-2 lg:hidden"
        role="tablist"
        aria-label="Panel layar kecil"
      >
        <PixelButton
          variant={mobileTab === 'deck' ? 'copper' : 'slate'}
          onClick={() => setMobileTab('deck')}
        >
          Kode &amp; Dunia
        </PixelButton>
        <PixelButton
          variant={mobileTab === 'piko' ? 'copper' : 'slate'}
          onClick={() => setMobileTab('piko')}
        >
          Piko &amp; Catatan
        </PixelButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Kolom pendamping: Piko vertikal + panel bertab + fokus + aksi */}
        <aside
          className={`${mobileTab === 'piko' ? 'flex' : 'hidden'} min-h-0 w-full shrink-0 flex-col gap-3 lg:flex lg:w-[320px]`}
        >
          <PikoMascotWidget />
          {!isBot && engineFailed ? (
            <div
              className="rounded-[4px] px-3 py-2"
              style={{
                backgroundColor: 'rgba(255,77,109,0.1)',
                border: '2px solid rgba(255,77,109,0.45)',
              }}
            >
              <p
                className="mb-2 text-[13.5px] leading-snug"
                style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#f2ead6' }}
              >
                Mesin data sedang mati, jadi query belum bisa dijalankan. Editor di
                samping tetap bisa kamu pakai untuk menulis.
              </p>
              <PixelButton variant="copper" onClick={startEngine}>
                Coba Nyalakan Mesin Data
              </PixelButton>
            </div>
          ) : null}
          {/* Panel bertab: Cerita (konteks misi) | Cek Kode (CATATAN PIKO) */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px]"
            style={{
              backgroundColor: 'rgba(16,19,26,0.72)',
              border: '2px solid rgba(216,204,184,0.22)',
            }}
          >
            <div
              className="flex shrink-0 gap-1 border-b-2 px-2 pt-2"
              style={{ borderColor: 'rgba(216,204,184,0.16)' }}
              role="tablist"
              aria-label="Panel pendamping"
            >
              {(
                [
                  ['cerita', 'Cerita'],
                  ['kode', 'Cek Kode'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === key}
                  onClick={() => setSideTab(key)}
                  className="min-h-[36px] rounded-t-[4px] px-3 text-[13px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    fontFamily: "'Pixelify Sans', sans-serif",
                    backgroundColor:
                      sideTab === key ? 'rgba(244,180,27,0.16)' : 'transparent',
                    color: sideTab === key ? '#f4b41b' : '#8d99ab',
                    border: '1.5px solid rgba(216,204,184,0.22)',
                    borderBottom: 'none',
                  }}
                >
                  {label}
                  {key === 'kode' && lintErrors.length > 0
                    ? ` (${lintErrors.length})`
                    : ''}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {sideTab === 'cerita' ? (
                <div
                  className="space-y-2 text-[14px] leading-snug"
                  style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#f2ead6' }}
                >
                  <p>{quest.storyContext}</p>
                  <p>
                    <b style={{ color: '#f4b41b' }}>Tujuan:</b> {quest.objectiveText}
                  </p>
                </div>
              ) : (
                <div role="status" aria-live="polite">
                  {lintItems.length > 0 ? (
                    <>
                      <p
                        className="mb-1 text-[12px] font-bold uppercase tracking-[0.16em]"
                        style={{
                          fontFamily: "'Pixelify Sans', sans-serif",
                          color: '#ff8fa5',
                        }}
                      >
                        Catatan Piko
                      </p>
                      <ul
                        className="space-y-1 text-[13.5px] leading-snug"
                        style={{
                          fontFamily: "'Pixelify Sans', sans-serif",
                          color: '#f2ead6',
                        }}
                      >
                        {lintItems.map((item, i) => (
                          <li key={i}>
                            {item.text}
                            {item.suggestion ? (
                              <span style={{ color: '#00f5d4' }}> {item.suggestion}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p
                      className="text-[13.5px] leading-snug"
                      style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#8d99ab' }}
                    >
                      Belum ada catatan. Kalau kodemu membuat Piko garuk-garuk kepala,
                      diagnosisnya muncul di sini.
                    </p>
                  )}
                  <p
                    className="mt-3 border-t pt-2 text-[12.5px] leading-snug"
                    style={{
                      fontFamily: "'Pixelify Sans', sans-serif",
                      color: '#8d99ab',
                      borderColor: 'rgba(216,204,184,0.16)',
                    }}
                  >
                    Modul di quest ini: {quest.unlockedCartridges.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
          <FocusBar />
          <div className="flex flex-wrap gap-2">
            <PixelButton variant="moss" onClick={handleHint}>
              Minta Petunjuk
            </PixelButton>
            <PixelButton variant="slate" onClick={() => setCode(quest.initialCode)}>
              Ulangi Kode Awal
            </PixelButton>
          </div>
        </aside>

        {/* Deck */}
        <div
          className={`${mobileTab === 'deck' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col lg:flex`}
        >
          <CyberDeckFrame
            title="CYBER-DECK"
            lampState={lampState}
            stickers={stickers}
            rightRail={<RunLever questId={quest.id} disabled={running} />}
          >
            <div className="flex h-full min-h-0 flex-col">
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
                <div
                  className="grid min-h-0 flex-1"
                  style={{ gridTemplateColumns: '1.15fr 0.85fr' }}
                >
                  <div className="min-w-0 overflow-hidden">
                    <InteractiveEditor
                      ref={editorRef}
                      value={code}
                      onChange={setCode}
                      mode="BOT_SCRIPT"
                      lintErrors={lintErrors}
                      currentLine={currentLine}
                      readOnly={running}
                    />
                  </div>
                  <div
                    className="min-w-0 border-l-2"
                    style={{
                      borderColor: 'rgba(216,204,184,0.14)',
                      backgroundColor: '#1a1410',
                    }}
                  >
                    <BotGridStage
                      setup={quest.botWorldSetup}
                      startPos={[0, 2]}
                      resetKey={botResetKey}
                      onPoseChange={(pose) => {
                        poseRef.current = pose;
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1">
                    <InteractiveEditor
                      ref={editorRef}
                      value={code}
                      onChange={setCode}
                      mode="SQL"
                      lintErrors={lintErrors}
                      currentLine={currentLine}
                      readOnly={running}
                    />
                  </div>
                  <div
                    className="shrink-0 border-t-2"
                    style={{
                      borderColor: 'rgba(216,204,184,0.14)',
                      height: 'var(--bt-vis-band, 248px)',
                    }}
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
      {/* Overlay dialog: pembuka = modal ber-backdrop; dialog cerita lain
          (sukses/funny) = bilah bawah TANPA backdrop agar dunia tetap
          terlihat (koreksi ui-ux: jangan modal-kan funny-fail). */}
      {dialogue ? (
        <div
          className={
            dialogueKind === 'intro'
              ? 'absolute inset-0 z-30 flex items-end justify-center p-4 sm:items-center'
              : 'pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4'
          }
          style={
            dialogueKind === 'intro' ? { backgroundColor: 'rgba(8,6,4,0.62)' } : undefined
          }
        >
          <div
            className={`w-full max-w-2xl ${dialogueKind === 'intro' ? '' : 'pointer-events-auto'}`}
            onClick={() => {
              // Klik pertama menyelesaikan efek ketik (diurus DialogueBox);
              // klik berikutnya — setelah baris selesai — lanjut / tutup.
              if (dialogueLineDone) advanceDialogue();
            }}
          >
            <DialogueBox
              key={`${quest.id}-dlg-${dialogue.idx}`}
              name={dialogue.lines[dialogue.idx].speaker}
              text={dialogue.lines[dialogue.idx].text}
              onFinished={() => setDialogueLineDone(true)}
            />
            <p
              className="mt-1 h-4 text-right text-[12px] font-semibold uppercase tracking-[0.14em]"
              style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#d8ccb8' }}
            >
              {dialogueLineDone
                ? dialogue.idx + 1 >= dialogue.lines.length
                  ? 'Klik dialog untuk menutup'
                  : 'Klik dialog untuk lanjut'
                : ''}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CyberDeckScreen;
