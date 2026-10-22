/**
 * Keadaan jembatan React <-> Phaser untuk dunia (Fase 2).
 *
 * Pola komunikasi (blueprint §3 aturan 1): ui/ tidak menyentuh objek
 * Phaser; engine tidak mengimpor React. Yang lewat di sini hanya:
 *  - referensi scene yang sedang hidup (untuk pause/resume/apply state),
 *  - input sentuh bersama (joystick DOM -> dibaca scene tiap frame),
 *  - callback interaksi (scene -> host React lewat createWorld).
 * Sinyal diskret (OPEN_DECK, dialog, prompt, WORLD_PAUSE/RESUME) tetap
 * lewat eventBus di core/bridge.
 */
import type { Interactable } from './mapData';

export interface TouchInputState {
  /** Vektor joystick ternormalisasi (-1..1). */
  x: number;
  y: number;
  /** Tombol interaksi sentuh: di-set host, dikonsumsi scene. */
  interact: boolean;
}

export interface WorldSceneHooks {
  onInteract: (target: Interactable) => void;
}

/** Antarmuka sempit scene yang boleh disentuh jembatan. */
export interface WorldSceneHandle {
  applyCompletedQuests: (completedQuests: readonly string[]) => void;
  pauseWorld: () => void;
  resumeWorld: () => void;
}

export interface WorldBridgeState {
  touch: TouchInputState;
  hooks: WorldSceneHooks;
  completedQuests: string[];
  scene: WorldSceneHandle | null;
}

export const worldBridge: WorldBridgeState = {
  touch: { x: 0, y: 0, interact: false },
  hooks: { onInteract: () => undefined },
  completedQuests: [],
  scene: null,
};

// ---------------------------------------------------------------------------
// Pause bersama: WORLD_PAUSE/WORLD_RESUME bisa datang dari dua sumber
// sekaligus (deck via store.setCodingMode + dialog dunia). Hitung
// tumpangannya; scene hanya jalan lagi saat hitungan kembali ke nol.
let pauseCounter = 0;

export function noteWorldPause(): void {
  pauseCounter += 1;
  worldBridge.scene?.pauseWorld();
}

export function noteWorldResume(): void {
  pauseCounter = Math.max(0, pauseCounter - 1);
  if (pauseCounter === 0) worldBridge.scene?.resumeWorld();
}

export function currentPauseCount(): number {
  return pauseCounter;
}
