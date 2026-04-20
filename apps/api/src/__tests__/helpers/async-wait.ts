/**
 * Shared async-wait primitives for tests that coordinate with real-time
 * side effects (SSE streams, abort propagation, queue drain, etc). All
 * three helpers are pure timing utilities — they don't touch Vitest's
 * fake timers, so tests can still opt into `vi.useFakeTimers()` at the
 * describe level where appropriate.
 */

/**
 * Bounded sleep helper. Exists so test suites can route every wall-clock
 * wait through a named function and not bare
 * `new Promise(r => setTimeout(r, n))` calls scattered across files. Use
 * sparingly and only when there is no observable side-effect to poll on
 * (see {@link waitFor} / {@link waitForStable}).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll `condition` until it returns truthy or `timeoutMs` elapses. Throws
 * on timeout so callers get a loud failure instead of a silent hang.
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 3000,
  intervalMs = 25,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await sleep(intervalMs);
  }
  if (!condition()) throw new Error("waitFor timed out");
}

/**
 * Poll `invariant` for `stableMs` to prove it is *persistently* true —
 * use instead of a bare sleep when the test asserts a "must not change"
 * property (e.g. a warn counter should stay constant while another SSE
 * client connects). Returns early with an assertion failure the moment
 * the invariant flips.
 */
export async function waitForStable(
  invariant: () => boolean,
  stableMs: number,
  intervalMs = 25,
): Promise<void> {
  const deadline = Date.now() + stableMs;
  while (Date.now() < deadline) {
    if (!invariant()) {
      throw new Error("waitForStable: invariant became false during the stability window");
    }
    await sleep(intervalMs);
  }
}
