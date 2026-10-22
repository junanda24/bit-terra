import { describe, expect, it, vi } from 'vitest';
import { nextStepWithTimeout } from './stepWatchdog';

// The helper uses window.setTimeout; in the node test env there is no
// window, so provide the global timers under that name.
vi.stubGlobal('window', { setTimeout, clearTimeout });

describe('nextStepWithTimeout', () => {
  it('returns the step when the generator answers in time', async () => {
    const next = Promise.resolve<IteratorResult<string>>({
      done: false,
      value: 'step-1',
    });
    const outcome = await nextStepWithTimeout(next, 1_000);
    expect(outcome.timeout).toBe(false);
    if (!outcome.timeout) {
      expect(outcome.result.done).toBe(false);
      expect(outcome.result.value).toBe('step-1');
    }
  });

  it('reports a timeout when the step never resolves', async () => {
    const stuck = new Promise<IteratorResult<string>>(() => {
      /* never resolves — the pathological await the watchdog exists for */
    });
    const outcome = await nextStepWithTimeout(stuck, 20);
    expect(outcome.timeout).toBe(true);
  });

  it('propagates generator errors instead of swallowing them', async () => {
    const failing = Promise.reject<IteratorResult<string>>(new Error('ledak'));
    await expect(nextStepWithTimeout(failing, 1_000)).rejects.toThrow('ledak');
  });
});
