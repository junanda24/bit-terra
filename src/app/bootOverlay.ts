/**
 * Boot stage pub/sub — a tiny module-level stage setter (same pattern as the
 * electronics simulator's boot overlay). Any boot step can call setBootStage()
 * and the BootOverlay component re-renders with the new stage text, so the
 * player always sees an explicit loading state, never a blank screen.
 */

type Listener = () => void;

let stage = 'Memuat aplikasi…';
const listeners = new Set<Listener>();

export function setBootStage(next: string): void {
  if (next === stage) return;
  stage = next;
  for (const fn of listeners) fn();
}

export function getBootStage(): string {
  return stage;
}

export function subscribeBootStage(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
