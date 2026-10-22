import mitt from 'mitt';
import type { GameEvents } from '../../shared/types';

/**
 * Typed event bus (mitt) — the ONLY action channel between the React UI
 * layer and the game/sandbox layers (docs/BLUEPRINT.md §3 rule 1, §5).
 * Event names and payloads come from src/shared/types.ts GameEvents.
 *
 * Typing note: GameEvents is an `interface`, and interfaces carry no
 * implicit index signature, so mitt's own `Emitter<GameEvents>` generic
 * (constrained to Record<EventType, unknown>) cannot be instantiated with
 * it. The runtime is a plain mitt emitter; the exported surface below is
 * hand-typed against GameEvents so every on/off/emit stays fully checked.
 */

export type GameEventHandler<K extends keyof GameEvents> = (event: GameEvents[K]) => void;

export type GameWildcardHandler = (
  type: keyof GameEvents,
  event: GameEvents[keyof GameEvents],
) => void;

export interface GameEventBus {
  on<K extends keyof GameEvents>(type: K, handler: GameEventHandler<K>): void;
  on(type: '*', handler: GameWildcardHandler): void;
  off<K extends keyof GameEvents>(type: K, handler?: GameEventHandler<K>): void;
  off(type: '*', handler?: GameWildcardHandler): void;
  emit<K extends keyof GameEvents>(type: K, event: GameEvents[K]): void;
  /** mitt's handler registry — exposed for tests and diagnostics. */
  all: Map<keyof GameEvents | '*', Array<GameEventHandler<keyof GameEvents> | GameWildcardHandler>>;
}

export const eventBus = mitt() as unknown as GameEventBus;

export type { GameEvents };
export default eventBus;
