/**
 * Boot stage pub/sub — a tiny module-level stage setter (same pattern as the
 * electronics simulator's boot overlay). Any boot step can call setBootStage()
 * and the BootOverlay component re-renders with the new stage text, so the
 * player always sees an explicit loading state, never a blank screen.
 */

type Listener = () => void;

let stage = 'Memuat aplikasi…';
let bootError: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function setBootStage(next: string): void {
  if (next === stage) return;
  stage = next;
  notify();
}

export function getBootStage(): string {
  return stage;
}

/**
 * Boot failure state (self-healing, BLUEPRINT §7). If a boot step throws,
 * the overlay must stop pretending to load and say so — with a reload
 * button — instead of spinning forever.
 */
export function setBootError(message: string | null): void {
  if (message === bootError) return;
  bootError = message;
  notify();
}

export function getBootError(): string | null {
  return bootError;
}

export function subscribeBootStage(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
