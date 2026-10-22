/**
 * createWorld — pabrik jembatan React <-> Phaser untuk Desa Bit-Terra.
 *
 * Phaser + VillageScene dimuat DINAMIS di sini: chunk dunia terpisah dari
 * bundle utama dan dari Cyber-Deck (deck tidak pernah membayar biaya
 * unduh Phaser). Berkas ini sendiri tidak mengimpor Phaser secara statis.
 *
 * Keputusan interaksi hidup di sini (bukan di scene): anchor quest yang
 * belum selesai -> OPEN_DECK; sisanya -> dialog dunia via WORLD_DIALOGUE.
 */
import { eventBus } from '../core/bridge/eventBus';
import { isQuestUnlocked, lockBlockerId } from '../core/progression';
import { ALL_QUESTS } from '../content/quests/index';
import { noteWorldPause, noteWorldResume, worldBridge } from './bridgeState';
import { getBrainFogDialogue, getWorldDialogue } from './npcDialogues';
import type { Interactable } from './mapData';

export interface WorldHandle {
  setCompletedQuests: (completedQuests: readonly string[]) => void;
  destroy: () => void;
}

/** Urutan rantai progresi dari indeks konten (sumber kebenaran picker juga). */
const QUEST_ORDER: readonly string[] = ALL_QUESTS.map((q) => q.id);

function handleInteract(target: Interactable): void {
  const completed = worldBridge.completedQuests;
  if (target.kind === 'quest' && target.questId) {
    if (completed.includes(target.questId) && target.doneDialogueId) {
      const dlg = getWorldDialogue(target.doneDialogueId, completed);
      if (dlg) {
        eventBus.emit('WORLD_DIALOGUE', { name: dlg.name, lines: dlg.lines });
        return;
      }
    }
    // Progresi berurutan (Fase 3): jangkar quest yang belum terbuka tidak
    // membuka deck — Kabut Otak menolak dengan lembut dan menyebut quest
    // yang harus diselesaikan lebih dulu.
    if (!isQuestUnlocked(target.questId, QUEST_ORDER, completed)) {
      const blockerId = lockBlockerId(target.questId, QUEST_ORDER, completed);
      const blockerTitle =
        ALL_QUESTS.find((q) => q.id === blockerId)?.title ?? 'misi sebelumnya';
      const dlg = getBrainFogDialogue(blockerTitle);
      eventBus.emit('WORLD_DIALOGUE', { name: dlg.name, lines: dlg.lines });
      return;
    }
    eventBus.emit('OPEN_DECK', { questId: target.questId });
    return;
  }
  if (target.dialogueId) {
    const dlg = getWorldDialogue(target.dialogueId, completed);
    if (dlg) eventBus.emit('WORLD_DIALOGUE', { name: dlg.name, lines: dlg.lines });
  }
}

export async function createWorld(
  parent: HTMLElement,
  initialCompleted: readonly string[],
): Promise<WorldHandle> {
  const [{ default: Phaser }, { VillageScene }] = await Promise.all([
    import('phaser'),
    import('./VillageScene'),
  ]);

  worldBridge.completedQuests = [...initialCompleted];
  worldBridge.hooks.onInteract = handleInteract;

  const onPause = () => noteWorldPause();
  const onResume = () => noteWorldResume();
  eventBus.on('WORLD_PAUSE', onPause);
  eventBus.on('WORLD_RESUME', onResume);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d2b1a',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 720,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [VillageScene],
  });

  return {
    setCompletedQuests(completedQuests: readonly string[]) {
      worldBridge.completedQuests = [...completedQuests];
      worldBridge.scene?.applyCompletedQuests(completedQuests);
    },
    destroy() {
      eventBus.off('WORLD_PAUSE', onPause);
      eventBus.off('WORLD_RESUME', onResume);
      worldBridge.scene = null;
      game.destroy(true);
    },
  };
}
