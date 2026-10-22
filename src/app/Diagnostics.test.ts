import { afterEach, describe, expect, it } from 'vitest';
import { runDiagnostics } from './Diagnostics';

describe('runDiagnostics (node smoke test)', () => {
  it('always resolves with four named, honest results — never throws', async () => {
    const results = await runDiagnostics();
    expect(results).toHaveLength(4);
    const names = results.map((r) => r.name);
    expect(names.some((n) => n.includes('SQL'))).toBe(true);
    expect(names.some((n) => n.includes('IndexedDB'))).toBe(true);
    expect(names.some((n) => n.includes('AudioContext'))).toBe(true);
    expect(names.some((n) => n.includes('localStorage'))).toBe(true);
    for (const r of results) {
      expect(typeof r.ok).toBe('boolean');
      expect(typeof r.detail).toBe('string');
      expect(r.detail.length).toBeGreaterThan(0);
    }
    // In the node test environment the browser-only capabilities do not
    // exist, so those checks must honestly report failure, never fake a pass.
    // (The SQL check is environment-dependent: sql.js genuinely loads under
    // vitest, so its ok value is not pinned here — only its shape is.)
    const browserOnly = results.filter(
      (r) => !r.name.includes('SQL'),
    );
    expect(browserOnly).toHaveLength(3);
    expect(browserOnly.every((r) => !r.ok)).toBe(true);
  });
});

describe('runDiagnostics IndexedDB check probes the REAL save DB (CORE-M4)', () => {
  interface FakeReq {
    error: Error | null;
    result: { version: number; close: () => void };
    transaction: { abort: () => void };
    onupgradeneeded: (() => void) | null;
    onerror: (() => void) | null;
    onblocked: (() => void) | null;
    onsuccess: (() => void) | null;
  }

  function installFakeIdb(behavior: 'error' | 'fresh'): string[] {
    const opened: string[] = [];
    const stub = {
      open: (name: string) => {
        opened.push(name);
        const req: FakeReq = {
          error: new Error('diblokir untuk uji'),
          result: { version: 1, close: () => {} },
          transaction: { abort: () => {} },
          onupgradeneeded: null,
          onerror: null,
          onblocked: null,
          onsuccess: null,
        };
        queueMicrotask(() => {
          if (behavior === 'fresh') req.onupgradeneeded?.();
          req.onerror?.();
        });
        return req;
      },
    };
    (globalThis as Record<string, unknown>)['indexedDB'] = stub;
    return opened;
  }

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['indexedDB'];
  });

  it('opens "bit-terra" (not a throwaway diagnostics DB) and reports refusal honestly', async () => {
    const opened = installFakeIdb('error');
    const results = await runDiagnostics();
    const idb = results.find((r) => r.name.includes('IndexedDB'));
    expect(opened).toEqual(['bit-terra']);
    expect(idb?.ok).toBe(false);
    expect(idb?.detail).toContain('bit-terra');
  });

  it('a not-yet-created save DB (upgrade aborted) is an honest green: pemain baru', async () => {
    const opened = installFakeIdb('fresh');
    const results = await runDiagnostics();
    const idb = results.find((r) => r.name.includes('IndexedDB'));
    expect(opened).toEqual(['bit-terra']);
    expect(idb?.ok).toBe(true);
    expect(idb?.detail).toContain('belum terbentuk');
  });
});
