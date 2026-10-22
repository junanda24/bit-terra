/**
 * Step watchdog for bot-script runs (self-healing, BLUEPRINT §7).
 *
 * StepInterpreter is an async generator; a pathological script (or a stuck
 * await inside it) could leave the deck "running" forever with the lever
 * locked. nextStepWithTimeout races one generator step against a deadline
 * so the screen can stop the run cleanly. Synchronous infinite loops are
 * NOT this helper's problem — the interpreter's LoopGuard (500 ticks)
 * already bounds them; this covers steps that never resolve.
 */

export const STEP_WATCHDOG_MS = 5_000;

export type StepOutcome<T> =
  | { timeout: true }
  | { timeout: false; result: IteratorResult<T> };

export function nextStepWithTimeout<T>(
  next: Promise<IteratorResult<T>>,
  timeoutMs: number,
): Promise<StepOutcome<T>> {
  return new Promise<StepOutcome<T>>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      resolve({ timeout: true });
    }, timeoutMs);
    next.then(
      (result) => {
        window.clearTimeout(timer);
        resolve({ timeout: false, result });
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}
