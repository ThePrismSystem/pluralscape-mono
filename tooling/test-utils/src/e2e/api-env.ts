/**
 * Environment helpers for spawning API server children from test bootstraps.
 *
 * `apps/api/src/index.ts` gates its `start()` call on `!process.env["VITEST"]`
 * to avoid an async teardown race when the module is `import`ed by vitest
 * unit tests. The spawned E2E server is a separate process that must run
 * `start()`; inheriting a parent `VITEST` flag silences it and the health
 * check times out.
 *
 * `inheritEnvWithoutVitest` returns a copy of `process.env` with the
 * `VITEST` key absent (not just set to `undefined`), without mutating
 * `process.env` itself.
 */

export function inheritEnvWithoutVitest(): NodeJS.ProcessEnv {
  const { VITEST: _dropped, ...inherited } = process.env;
  void _dropped;
  return inherited;
}
