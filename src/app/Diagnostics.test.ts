import { describe, expect, it } from 'vitest';
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
