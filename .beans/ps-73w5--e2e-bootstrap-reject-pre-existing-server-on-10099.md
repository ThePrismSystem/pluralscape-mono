---
# ps-73w5
title: "E2E bootstrap: reject pre-existing server on :10099 and surface non-JSON stderr"
status: completed
type: bug
priority: normal
created_at: 2026-04-19T19:12:07Z
updated_at: 2026-04-20T00:33:04Z
parent: ps-0enb
---

Discovered while debugging ps-0enb batch PR 2026-04-19. Two latent bugs in apps/api-e2e/src/global-setup.ts: (1) pollHealth() accepts any process answering /health, including a zombie from a prior crashed run. Should refuse to proceed when port 10099 is already bound before spawn, or fingerprint the server. (2) stderr filter at lines 298-304 forwards only pino level:50/60 JSON. Raw stderr like Bun EADDRINUSE is swallowed. Either forward all stderr or add explicit post-spawn check for early exit / port conflict. These bugs let a zombie bun from an earlier crashed run cause 491/509 E2E test failures.

## Todo

- [x] Add assertPortFree helper + unit tests
- [x] Widen pollHealth signature with early-exit detection + unit tests
- [x] Wire into tooling/test-utils/src/e2e/api-server.ts
- [x] Wire into apps/api-e2e/src/global-setup.ts (delete local pollHealth)
- [x] Manual acceptance check with a port squatter
- [x] Full verify suite green

## Summary of Changes

- Added `assertPortFree` helper in `tooling/test-utils/src/e2e/assert-port-free.ts`; unit-tested for free / busy / no-leak cases.
- Widened `pollHealth` in `tooling/test-utils/src/e2e/api-server.ts` to an options-object signature with optional `child: ChildProcess` and `stderrTail: readonly string[]`; early child exit now rejects with exit code + signal + recent stderr instead of letting the poll loop time out or attach to a zombie. Early-exit detection is seeded from `child.exitCode` to handle children that already exited before pollHealth was called.
- Updated `spawnApiServer` (test-utils) and `apps/api-e2e/src/global-setup.ts` to: call `assertPortFree(E2E_PORT)` pre-spawn, classify stderr per-line (so raw Bun errors in mixed chunks are no longer swallowed by the pino filter), forward everything that isn't well-formed pino INFO/DEBUG/WARN, and feed a bounded stderr tail into `pollHealth`.
- Deleted the duplicated local `pollHealth` (and now-unused `HEALTH_POLL_MS`) from `apps/api-e2e/src/global-setup.ts`; both bootstrap paths now share the hardened helper.
- Added unit coverage for `pollHealth` healthy-path, timeout, and early-exit behaviors.
- Added `@pluralscape/test-utils` as a declared devDependency of `apps/api-e2e` (it was previously undeclared).
- Exposed `@pluralscape/test-utils/e2e/assert-port-free` and `@pluralscape/test-utils/e2e/api-server` as sub-path exports so Playwright consumers can import the helpers directly without transitively pulling in `vitest/expect` via the main `/e2e` barrel. The barrel re-exports `ref-helpers.ts` which imports `expect` from vitest, and that import pollutes Playwright's `expect` with `Cannot redefine property: Symbol($$jest-matchers-object)`. Caught during manual acceptance (Task 5).

## Manual acceptance

With a dummy Bun server squatting on `:10099`, `pnpm test:e2e` now fails fast in global-setup with the new message (`Port 10099 is already in use ... lsof -iTCP:10099 -sTCP:LISTEN -nP / kill <pid>`) instead of running the suite against the zombie. With the squatter removed, setup completes normally and the API becomes healthy.

## Verify suite (run 9771)

All 9 steps green: format, lint, typecheck, unit, integration, e2e, e2e-slow, sp-import, pk-import.
