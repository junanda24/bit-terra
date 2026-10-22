/**
 * Chunk-stale guard (self-healing pass, docs/BLUEPRINT.md §7).
 *
 * After a redeploy, an already-open tab can hold an index.html that points
 * at chunk files which no longer exist. Loading one fails (the entry bundle
 * in index.html has an inline twin of this guard; lazy chunks surface as
 * `vite:preloadError` in main.tsx). The cure is one reload — but only one:
 * if the fresh bundle fails the same way, reloading again would loop
 * forever, so a second failure inside the window is logged and left alone.
 */

import { logError } from './errorLog';

export const CHUNK_RELOAD_KEY = 'bitterra:chunk-reload-at';
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

/**
 * Pure decision: may we reload at `now`, given the timestamp of the last
 * chunk reload (`null` = never)? A last-reload in the future (clock skew)
 * counts as "just reloaded" — no reload.
 */
export function shouldReloadForChunkError(
  now: number,
  lastReloadAt: number | null,
): boolean {
  if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true;
  return now - lastReloadAt >= CHUNK_RELOAD_WINDOW_MS;
}

function readLastReloadAt(): number | null {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Handle a chunk load failure. Reloads at most once per window; returns
 * true when a reload was triggered. Always logs — a swallowed chunk error
 * would otherwise look like a mysteriously dead button.
 */
export function handleChunkLoadFailure(scope = 'chunk'): boolean {
  const err = new Error(`Chunk gagal dimuat (${scope}) — kemungkinan berkas aplikasi sudah berubah.`);
  console.error('[Bit-Terra]', err);
  logError(err, scope);
  const now = Date.now();
  if (!shouldReloadForChunkError(now, readLastReloadAt())) return false;
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    /* storage unavailable — still try the one reload */
  }
  window.location.reload();
  return true;
}
