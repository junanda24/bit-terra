import { useEffect, useRef, useState } from 'react';
import { BootOverlay } from './app/BootOverlay';
import { RecoveryBoundary } from './app/RecoveryBoundary';
import { setBootStage } from './app/bootOverlay';
import { selectPersistedProgress, useGameStore } from './core/bridge/gameStore';
import {
  exportSave,
  importSave,
  load as loadSave,
  save as saveProgress,
} from './core/persistence/saveSystem';
import { soundController } from './core/audio/SoundController';
import { CyberDeckScreen } from './ui/cyberdeck/CyberDeckScreen';
import type { QuestDefinition } from './shared/types';

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
  } catch {
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
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
      setBootStage('Menyiapkan Cyber-Deck…');
      const saved = await loadSave();
      if (saved) useGameStore.getState().hydrate(saved);
      const list = await loadQuestIndex();
      if (cancelled) return;
      setQuests(list);
      setQuestsLoaded(true);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    store.setCurrentQuest(quest.id, quest.mode === 'HYBRID' ? store.editorMode : quest.mode);
    store.sayPiko(quest.storyContext, 'normal');
    setDeckOpen(true);
  };

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

  // Deck view: a quest is open in the Cyber-Deck. The frame inside
  // CyberDeckScreen switches coding mode on (world pause + adaptive music
  // mix) on mount and resumes on unmount.
  if (ready && deckOpen && selectedQuest) {
    return (
      <div
        className="min-h-screen"
        style={{
          background: 'var(--bt-slate)',
          color: 'var(--bt-bezel)',
          fontFamily: '"Pixelify Sans", sans-serif',
        }}
      >
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-6">
          <button
            type="button"
            onClick={() => setDeckOpen(false)}
            className="border-2 px-3 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--bt-copper)', color: 'var(--bt-bezel)' }}
          >
            Kembali ke Daftar Quest
          </button>
          <span
            className="text-xs"
            style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-amber)' }}
          >
            CYBER-DECK
          </span>
          <button
            type="button"
            onClick={() => void handleMusicToggle()}
            className="border-2 px-3 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--bt-copper)', color: 'var(--bt-bezel)' }}
          >
            {musicOn ? 'Musik: Nyala' : 'Musik: Mati'}
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-10">
          <CyberDeckScreen quest={selectedQuest} onClose={() => setDeckOpen(false)} />
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bt-slate)',
        color: 'var(--bt-bezel)',
        fontFamily: '"Pixelify Sans", sans-serif',
      }}
    >
      {!ready && <BootOverlay />}

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
        </div>
      </header>

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
              return (
                <button
                  key={quest.id}
                  type="button"
                  onClick={() => handleQuestClick(quest)}
                  className="border-4 p-4 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    borderColor: selected ? 'var(--bt-amber)' : 'var(--bt-copper)',
                    background: '#1b2230',
                  }}
                  aria-pressed={selected}
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
                      {done ? ' · Selesai' : ''}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-bold">{quest.title}</div>
                  <p className="mt-1 line-clamp-3 text-sm opacity-80">{quest.objectiveText}</p>
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
