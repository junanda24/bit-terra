import { describe, expect, it } from 'vitest';
import {
  CHUNK_RELOAD_WINDOW_MS,
  shouldReloadForChunkError,
} from './chunkReload';

describe('shouldReloadForChunkError (pure window logic)', () => {
  const now = 1_700_000_000_000;

  it('allows a reload when there was never a previous one', () => {
    expect(shouldReloadForChunkError(now, null)).toBe(true);
  });

  it('blocks a second reload inside the 60s window (no reload loop)', () => {
    expect(shouldReloadForChunkError(now, now - 1_000)).toBe(false);
    expect(shouldReloadForChunkError(now, now - CHUNK_RELOAD_WINDOW_MS + 1)).toBe(false);
  });

  it('allows a reload once the window has passed', () => {
    expect(shouldReloadForChunkError(now, now - CHUNK_RELOAD_WINDOW_MS)).toBe(true);
    expect(shouldReloadForChunkError(now, now - CHUNK_RELOAD_WINDOW_MS - 5_000)).toBe(true);
  });

  it('treats a future timestamp (clock skew) as "just reloaded"', () => {
    expect(shouldReloadForChunkError(now, now + 5_000)).toBe(false);
  });

  it('treats a corrupt timestamp as "never reloaded"', () => {
    expect(shouldReloadForChunkError(now, Number.NaN)).toBe(true);
  });
});
