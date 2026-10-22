import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BootOverlay } from './app/BootOverlay';
import { DiagnosticsPanel } from './app/DiagnosticsPanel';
import { RecoveryBoundary } from './app/RecoveryBoundary';
import { setBootError, setBootStage } from './app/bootOverlay';
import { logError } from './app/errorLog';
import { eventBus } from './core/bridge/eventBus';
import { selectPersistedProgress, useGameStore } from './core/bridge/gameStore';
import { isQuestUnlocked, lockBlockerId } from './core/progression';
import {
  exportSave,
  importSave,
  installFlushOnHide,
  load as loadSave,
  save as saveProgress,
} from './core/persistence/saveSystem';
import { soundController } from './core/audio/SoundController';
import { CyberDeckScreen } from './ui/cyberdeck/CyberDeckScreen';
import type { QuestDefinition } from './shared/types';

// Desa (Phaser) dimuat malas: chunk dunia terpisah dari bundle utama, dan
// Cyber-Deck tidak ikut membayar biaya Phaser (Fase 2).
const WorldScreen = lazy(() => import('./ui/world/WorldScreen'));

// Content is data-driven (BLUEPRINT §3 rule 2): quests arrive as config
// modules under src/content/quests/. The glob resolves to {} until the
// content lands, and the shell falls back to honest placeholder cards.
const questIndexLoaders = import.meta.glob('./content/quests/index.ts');

async function loadQuestIndex(): Promise<QuestDefinition[]> {
  const loader = questIndexLoaders['./content/quests/index.ts'];
  if (!loader) return [];
  try {
    const mod = (await loader()) as {
      ALL_QUESTS?: QuestDefinition[];
      quests?: QuestDefinition[];
      QUESTS?: QuestDefinition[];
      default?: QuestDefinition[];
    };
    return mod.ALL_QUESTS ?? mod.quests ?? mod.QUESTS ?? mod.default ?? [];
  } catch (err) {
    // A failed quest chunk must leave a trace like every other failure
    // path in the app (audit CORE-L6) — the placeholder UI alone would
    // otherwise look identical to "content not built yet".
    console.error('[Bit-Terra] Memuat daftar quest gagal:', err);
    logError(err, 'quest-load');
    return [];
  }
}

const MODE_LABEL: Record<QuestDefinition['mode'], string> = {
  SQL: 'Mode SQL',
  BOT_SCRIPT: 'Mode Bot',
  HYBRID: 'Mode Campuran',
};

function AppShell() {
  const [ready, setReady] = useState(false);
  const [quests, setQuests] = useState<QuestDefinition[]>([]);
  const [questsLoaded, setQuestsLoaded] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentQuestId = useGameStore((s) => s.currentQuestId);
  const completedQuests = useGameStore((s) => s.completedQuests);
  const focus = useGameStore((s) => s.focus);
  const pikoLine = useGameStore((s) => s.pikoLine);
  const [deckOpen, setDeckOpen] = useState(false);
  const selectedQuest = quests.find((q) => q.id === currentQuestId) ?? null;

  // Boot: restore progress, then reveal the shell. The BootOverlay is up
  // from first paint, so the player never sees a blank screen.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setBootStage('Menyiapkan Cyber-Deck…');
        const saved = await loadSave();
        if (saved) useGameStore.getState().hydrate(saved);
        const list = await loadQuestIndex();
        if (cancelled) return;
        setQuests(list);
        setQuestsLoaded(true);
        setReady(true);
      } catch (err) {
        // Boot must never spin forever: surface the failure on the overlay
        // (self-healing, BLUEPRINT §7) and log it like every other error.
        console.error('[Bit-Terra] Boot gagal:', err);
        logError(err, 'boot');
        if (!cancelled) {
          setBootError(
            err instanceof Error ? err.message : 'Kesalahan tidak dikenal saat memuat.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush the pending autosave when the page is hidden or closed, so the
  // debounce window cannot eat the last seconds of progress (CORE-M2).
  useEffect(() => installFlushOnHide(), []);

  // Autosave (debounced) whenever persisted progress changes; the adaptive
  // music mix follows coding mode.
  useEffect(
    () =>
      useGameStore.subscribe((state, prev) => {
        if (
          state.completedQuests !== prev.completedQuests ||
          state.codeByQuest !== prev.codeByQuest ||
          state.focus !== prev.focus
        ) {
          saveProgress(selectPersistedProgress(state));
        }
        if (state.codingMode !== prev.codingMode) {
          soundController.setCodingMode(state.codingMode);
        }
      }),
    [],
  );

  const handleQuestClick = (quest: QuestDefinition) => {
    const store = useGameStore.getState();
    // Progresi berurutan (Fase 3): quest terkunci tidak membuka deck dari
    // jalur mana pun (kartu picker maupun anchor dunia). Piko menyebut
    // persis quest yang harus diselesaikan lebih dulu.
    const order = quests.map((q) => q.id);
    if (!isQuestUnlocked(quest.id, order, store.completedQuests)) {
      const blockerId = lockBlockerId(quest.id, order, store.completedQuests);
      const blockerTitle =
        quests.find((q) => q.id === blockerId)?.title ?? 'misi sebelumnya';
      store.sayPiko(
        `Misi "${quest.title}" masih tertutup kabut, Fixer. Selesaikan dulu: ${blockerTitle}.`,
        'confused',
      );
      return;
    }
    store.setCurrentQuest(quest.id, quest.mode === 'HYBRID' ? store.editorMode : quest.mode);
    // Teks cerita TIDAK lagi disalurkan ke balon Piko (audit layout E:
    // balon 170px + 561 karakter = menara teks). Cerita hidup di dialog
    // pembuka (modal) dan tab Cerita di dalam deck.
    setPickerOpen(false);
    setDeckOpen(true);
  };

  // Dunia (Phaser) meminta deck dibuka dari anchor quest (Fase 2).
  const questClickRef = useRef(handleQuestClick);
  questClickRef.current = handleQuestClick;
  const questsRef = useRef(quests);
  questsRef.current = quests;
  useEffect(() => {
    const onOpenDeck = (e: { questId: string }) => {
      const quest = questsRef.current.find((q) => q.id === e.questId);
      if (quest) questClickRef.current(quest);
    };
    eventBus.on('OPEN_DECK', onOpenDeck);
    return () => eventBus.off('OPEN_DECK', onOpenDeck);
  }, []);

  const handleMusicToggle = async () => {
    if (musicOn) {
      soundController.stop();
      setMusicOn(false);
    } else {
      const ok = await soundController.start();
      setMusicOn(ok);
      if (!ok) setSaveMessage('Musik tidak bisa dimulai di browser ini.');
    }
  };

  const handleExport = async () => {
    const name = await exportSave(selectPersistedProgress(useGameStore.getState()));
    setSaveMessage(
      name ? `Save diekspor sebagai ${name}.` : 'Belum ada progres yang bisa diekspor.',
    );
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await importSave(file);
    if (result.ok) {
      useGameStore.getState().hydrate(result.payload);
      setSaveMessage('Save berhasil dimuat. Selamat datang kembali di Bit-Terra.');
    } else {
      setSaveMessage(result.error);
    }
  };

  // Panel "beranda" Fase 1 (daftar quest + data save) — sekarang hidup
  // sebagai overlay Misi di atas desa, dan sebagai halaman boot sebelum
  // desa siap. Isi & perilakunya tidak berubah.
  const homePanels = (
    <>
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-end justify-between gap-4 px-4 pb-4 pt-8">
        <div>
          <h1
            className="text-lg sm:text-xl"
            style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-amber)' }}
          >
            BIT-TERRA
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--bt-copper)' }}>
            The Great Rollback — perbaiki desa, satu baris kode sekali jalan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs tracking-wide">FOKUS</div>
            <div
              className="mt-1 h-3 w-36 border"
              style={{ borderColor: 'var(--bt-copper)' }}
              role="progressbar"
              aria-valuenow={focus}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Bar fokus"
            >
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${focus}%`, background: 'var(--bt-sun)' }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleMusicToggle()}
            className="border-2 px-3 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--bt-copper)', color: 'var(--bt-bezel)' }}
          >
            {musicOn ? 'Musik: Nyala' : 'Musik: Mati'}
          </button>
          <button
            type="button"
            onClick={() => setDiagOpen(true)}
            className="border-2 px-3 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--bt-copper)', color: 'var(--bt-bezel)' }}
          >
            Periksa Kesehatan
          </button>
        </div>
      </header>

      {diagOpen && <DiagnosticsPanel onClose={() => setDiagOpen(false)} />}

      <main className="mx-auto w-full max-w-4xl px-4 pb-10">
        {pikoLine && (
          <div
            className="mb-5 border-2 p-4"
            style={{ borderColor: 'var(--bt-mint)', background: '#182233' }}
            role="status"
          >
            <span className="font-bold" style={{ color: 'var(--bt-mint)' }}>
              Piko:{' '}
            </span>
            <span>{pikoLine.text}</span>
          </div>
        )}

        <h2
          className="mb-3 text-xs"
          style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-bezel)' }}
        >
          PILIH QUEST
        </h2>

        {!questsLoaded && (
          <p role="status" className="text-sm">
            Memuat daftar quest…
          </p>
        )}

        {questsLoaded && quests.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {quests.map((quest) => {
              const selected = quest.id === currentQuestId;
              const done = completedQuests.includes(quest.id);
              const order = quests.map((q) => q.id);
              const locked = !isQuestUnlocked(quest.id, order, completedQuests);
              const blockerId = locked
                ? lockBlockerId(quest.id, order, completedQuests)
                : null;
              const blockerTitle =
                quests.find((q) => q.id === blockerId)?.title ?? 'misi sebelumnya';
              return (
                <button
                  key={quest.id}
                  type="button"
                  onClick={() => handleQuestClick(quest)}
                  className="border-4 p-4 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    borderColor: selected ? 'var(--bt-amber)' : 'var(--bt-copper)',
                    background: '#1b2230',
                    opacity: locked ? 0.72 : 1,
                  }}
                  aria-pressed={selected}
                  aria-disabled={locked}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-bold tracking-wide"
                      style={{ color: 'var(--bt-mint)' }}
                    >
                      {MODE_LABEL[quest.mode]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--bt-sun)' }}>
                      {quest.difficulty}
                      {done ? ' · Selesai' : locked ? ' · Terkunci' : ''}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-bold">{quest.title}</div>
                  <p className="mt-1 line-clamp-3 text-sm opacity-80">{quest.objectiveText}</p>
                  {locked && (
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--bt-sun)' }}>
                      Terkunci — selesaikan dulu: {blockerTitle}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {questsLoaded && quests.length === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Bangun, Piko!', mode: 'Mode Bot' },
              { title: 'Domba yang Tersesat', mode: 'Mode SQL' },
            ].map((card) => (
              <div
                key={card.title}
                className="border-4 p-4 opacity-60"
                style={{ borderColor: 'var(--bt-copper)', background: '#1b2230' }}
                aria-disabled="true"
              >
                <div
                  className="text-xs font-bold tracking-wide"
                  style={{ color: 'var(--bt-mint)' }}
                >
                  {card.mode}
                </div>
                <div className="mt-2 text-lg font-bold">{card.title}</div>
                <p role="status" className="mt-1 text-sm">
                  Konten quest sedang dimuat…
                </p>
              </div>
            ))}
            <p className="text-sm sm:col-span-2">
              Konten quest belum tersedia di build ini — daftar di atas adalah dua quest pertama
              Bit-Terra yang sedang disiapkan.
            </p>
          </div>
        )}

        <section className="mt-8 border-t pt-5" style={{ borderColor: 'var(--bt-copper)' }}>
          <h2
            className="mb-3 text-xs"
            style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-bezel)' }}
          >
            DATA SAVE
          </h2>
          <p className="mb-3 text-sm opacity-80">
            Progres tersimpan otomatis di browser ini. Ekspor sebagai file .bitterra untuk
            cadangan atau pindah perangkat.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="border-2 px-4 py-2 text-sm font-semibold"
              style={{
                borderColor: 'var(--bt-amber)',
                background: 'var(--bt-amber)',
                color: 'var(--bt-slate)',
              }}
            >
              Ekspor Save
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-2 px-4 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--bt-bezel)', color: 'var(--bt-bezel)' }}
            >
              Impor Save
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bitterra,application/json"
              className="hidden"
              onChange={(e) => {
                void handleImportFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {saveMessage && (
            <p role="status" className="mt-3 text-sm" style={{ color: 'var(--bt-mint)' }}>
              {saveMessage}
            </p>
          )}
        </section>
      </main>
    </>
  );

  // Boot belum selesai: halaman Fase 1 di balik BootOverlay (perilaku lama).
  if (!ready) {
    return (
      <div
        className="min-h-screen"
        style={{
          background: 'var(--bt-slate)',
          color: 'var(--bt-bezel)',
          fontFamily: '"Pixelify Sans", sans-serif',
        }}
      >
        <BootOverlay />
        {homePanels}
      </div>
    );
  }

  // Desa adalah rumah sekarang. Cyber-Deck dibuka sebagai lapisan di
  // atasnya: instance Phaser TETAP HIDUP (disembunyikan, bukan dibongkar)
  // sehingga posisi pemain & keadaan desa utuh saat deck ditutup. Frame
  // deck sendiri menembakkan WORLD_PAUSE/WORLD_RESUME lewat setCodingMode
  // saat mount/unmount — scene berhenti selama pemain berpikir.
  return (
    <div
      className="relative h-dvh overflow-hidden"
      style={{
        background: 'var(--bt-slate)',
        color: 'var(--bt-bezel)',
        fontFamily: '"Pixelify Sans", sans-serif',
      }}
    >
      <div
        className="h-full"
        style={{ visibility: deckOpen ? 'hidden' : 'visible' }}
        aria-hidden={deckOpen}
      >
        <Suspense
          fallback={
            <div
              className="flex h-full items-center justify-center"
              style={{ background: '#1d2b1a' }}
              role="status"
            >
              <p>Menyiapkan Desa Bit-Terra…</p>
            </div>
          }
        >
          <WorldScreen
            musicOn={musicOn}
            onToggleMusic={() => void handleMusicToggle()}
            onOpenMissions={() => setPickerOpen(true)}
          />
        </Suspense>
      </div>

      {pickerOpen && !deckOpen && (
        <div
          className="absolute inset-0 z-40 overflow-y-auto"
          style={{ background: 'rgba(10,13,18,0.78)' }}
        >
          <div
            className="mx-auto my-4 w-full max-w-4xl border-4 sm:my-8"
            style={{ borderColor: 'var(--bt-copper)', background: 'var(--bt-slate)' }}
          >
            <div className="flex justify-end px-4 pt-3">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="border-2 px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: 'var(--bt-bezel)', color: 'var(--bt-bezel)' }}
              >
                Kembali ke Desa
              </button>
            </div>
            {homePanels}
          </div>
        </div>
      )}

      {deckOpen && selectedQuest && (
        <div
          className="absolute inset-0 z-50 h-dvh overflow-hidden"
          style={{
            background: 'var(--bt-slate)',
            color: 'var(--bt-bezel)',
            fontFamily: '"Pixelify Sans", sans-serif',
          }}
        >
          <CyberDeckScreen
            quest={selectedQuest}
            onClose={() => setDeckOpen(false)}
            musicOn={musicOn}
            onToggleMusic={() => void handleMusicToggle()}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <RecoveryBoundary scope="app">
      <AppShell />
    </RecoveryBoundary>
  );
}
