---
# mobile-q04i
title: "PR #461 review remediation: opfs worker + driver fixes"
status: completed
type: task
priority: high
created_at: 2026-04-17T02:12:30Z
updated_at: 2026-04-19T22:56:37Z
parent: ps-0enb
---

Land all critical, important, and suggestion findings from the PR #461 multi-agent review onto branch feat/mobile-shr0-phase-2-opfs-worker as five domain commits before merge.

Spec: docs/superpowers/specs/2026-04-16-pr461-review-remediation-design.md
Plan: docs/superpowers/plans/2026-04-16-pr461-review-remediation-plan.md

## Commits

- [x] Commit 1: fix(mobile): opfs worker robustness (Tasks 2-9) — 4c294566 + nits 2622482
- [x] Commit 2: fix(mobile): opfs driver robustness + per-call timeout (Tasks 10-16) — 47116ddb + nits 91c09f59
- [x] Commit 3: refactor(mobile): dedupe indexeddb fallback + log opfs unavailability (Tasks 17-20) — d99ca4e7 + nits 7eb067b9
- [x] Commit 4: test(mobile): opfs E2E coverage for true LRU + functional indexeddb fallback (Tasks 21-23) — dc662808 + nits ed77d22e
- [x] Commit 5: chore(mobile): opfs comment cleanup + typed dispatch (Tasks 24-26) — 78325e0f + nits 4efd9a3b
- [x] Task 27: Full /verify + push + PR description update

## Critical fixes

- Worker missing messageerror/unhandledrejection listeners (infinite hang)
- Non-init send() calls have no timeout (infinite hang on stuck worker)

## Important fixes

- bindAndReset never calls sqlite3.reset
- pending slot leak on postMessage throw
- close() rethrows WorkerTerminatedError after worker error
- OPFS->IndexedDB fallback silent (violates fail-closed)
- handleClose finalize loop aborts on first throw
- txn rollback failures swallowed
- SQLite code field not propagated (blocks ps-gexi)

## Summary of Changes

Landed all critical, important, and suggestion findings from the PR #461 multi-agent review as 10 commits on `feat/mobile-shr0-phase-2-opfs-worker` (5 domain commits + 5 review-nit follow-ups).

### Critical fixes

- Worker now exports panic envelopes via global error/messageerror/unhandledrejection listeners — silent worker failures no longer hang main-thread callers.
- Driver `send()` enforces a 30s default per-call timeout (configurable via `OpfsSqliteDriverOptions.callTimeoutMs`; `null` disables) — closes the infinite-hang failure mode when the worker stalls.

### Important fixes

- `bindAndReset` now calls `sqlite3.reset` before `bind_collection` — cached statements correctly re-bind on second use instead of returning DONE.
- `postMessage` wrapped in try/catch — non-cloneable params and already-terminated worker no longer leak pending slots.
- `close()` is idempotent across worker-error and double-close paths.
- OPFS->IndexedDB fallback now logs via `globalThis.console.error` and always populates `storageFallbackReason` (no UI change; ps-gexi owns the user-facing UX).
- `handleClose` uses `Promise.allSettled` and always nulls state in `finally` — failing finalize no longer orphans the SQLite handle.
- Numeric SQLite `error.code` propagates through `Res.error.code` — directly enables ps-gexi `SQLITE_FULL` detection at the adapter boundary.
- Rollback failures and FinalizationRegistry finalize failures now log via `globalThis.console.warn`.
- Stale line-number reference in driver comment fixed; caller-reference and ESLint-rule-name comments dropped.

### Polish

- True LRU statement cache (re-insert on hit; was FIFO).
- `worker.onerror` rejects with `WorkerTerminatedError` and defensively calls `worker.terminate()`.
- Tagged `kind` discriminant on all four error classes (`OpfsDriverError`, `OpfsDriverUnavailableError`, `OpfsDriverTimeoutError` (new), `WorkerTerminatedError`).
- `call<T>` collapsed into `send<K extends Req["kind"]>` with file-local `ResultMap` and `ResultFor<K>` typed dispatch — eliminates per-call `as T` casts.
- `MAX_STMT_HANDLES`, `INIT_TIMEOUT_MS`, `CALL_TIMEOUT_MS`, `OPFS_UNAVAILABLE_REASON`, `OPFS_INIT_FAILED_PREFIX` extracted to constants files.
- `buildIndexedDbContext` helper in detect.ts dedupes the two fallback branches.
- Comment cleanup throughout (drop trivial WHATs, single-line JSDoc on self-describing protocol type aliases, lint-rule-name references).

### Tests

- Unit: 9 new opfs-worker tests (panic listeners, bindAndReset reset, allSettled finalize, code propagation, true LRU, txn fold). 9 new opfs-sqlite-driver tests (tagged-kind, per-call timeout x3, idempotent close, onerror terminate, panic envelope, rollback log, finalize log). 2 new detect tests (no-OPFS storageFallbackReason, observable fallback).
- E2E: `cache-fill.spec.ts` (renamed from lru-eviction; data-integrity assertion through real-Chromium worker post-eviction). `fallback.spec.ts` extended with functional IndexedDB round-trip; harness updated to fall back when worker construction fails.
- Mobile vitest: 1234/1234 passing.
- Mobile-web E2E: 7/7 passing.

### Bean cleanup

- `mobile-11h1` scrapped — the `onDroppedError` callback it was meant to wire was removed by the new driver architecture.
