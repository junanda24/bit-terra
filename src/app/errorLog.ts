/**
 * Local error log (self-healing pass, docs/BLUEPRINT.md §7).
 * Entries live in localStorage `bitterra:errorlog`, max 50, stacks truncated.
 * Every function swallows its own errors — logging must never crash the app.
 */

export interface ErrorLogEntry {
  at: string;
  scope: string;
  message: string;
  stack?: string;
}

const LOG_KEY = 'bitterra:errorlog';
const MAX_ENTRIES = 50;
const MAX_STACK = 1200;

export function logError(error: unknown, scope = 'app'): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry: ErrorLogEntry = {
      at: new Date().toISOString(),
      scope,
      message: err.message,
      stack: err.stack ? err.stack.slice(0, MAX_STACK) : undefined,
    };
    const entries = getErrorLog();
    entries.push(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* logging must never throw */
  }
}

export function getErrorLog(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}
