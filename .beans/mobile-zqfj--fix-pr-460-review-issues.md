---
# mobile-zqfj
title: "Fix PR #460 review issues"
status: completed
type: task
priority: normal
created_at: 2026-04-16T20:12:09Z
updated_at: 2026-04-19T22:56:37Z
parent: ps-0enb
---

Remediate all Critical/Important/Suggestion items from 5-agent review of PR #460 (async SqliteDriver contract). See docs/superpowers/plans/2026-04-16-mobile-shr0-opfs-worker-plan.md for Phase 1 context.

## Todo

### Group A — SyncProvider reliability (Critical)

- [x] A1/A2 Fix SyncProvider IIFE rejection swallow + partial-init leaks
- [~] Simplify cancelled flag (drop getter/setter pattern) — kept getter because ESLint no-unnecessary-condition narrows let flags across awaits

### Group B — DataLayer error surface (Important)

- [x] Add data:error event to event-map
- [x] Wire DataLayerProvider initialize/close errors through event bus

### Group C — Driver transaction correctness (Important)

- [x] C1 Extract runAsyncTransaction helper with AggregateError handling
- [x] C2 Use helper in bun, better-sqlite test helper, expo drivers
- [x] C3 Broaden fn type to T | Promise<T>
- [x] C4 Remove stale rollback comments
- [x] C5 Nested-transaction guard at driver level

### Group D — Type and interface cleanup

- [x] D1 Narrow OfflineQueueAdapter.close to Promise<void>
- [x] D2 Remove dead transaction field from BunSqliteDatabase

### Group E — Test coverage (Important)

- [x] E1 AggregateError test for bun driver
- [x] E2 AggregateError test for better-sqlite test helper (new file)
- [x] E3 COMMIT-failure path tests (both)
- [x] E4 Nested-transaction tests (both)
- [x] E5 SyncProvider cancellation-race test
- [x] E6 SyncProvider init-error test
- [x] E7 DataLayerProvider init-error test

### Group F — Test ergonomics

- [x] F1 Migrate await act(() => Promise.resolve()) to waitFor in SyncProvider tests

### Group G — Misc cleanups

- [x] G1 Extract OFFLINE_QUEUE_ID_PREFIX constant
- [x] G2 Narrow isDatabaseAccessible catch to SQLCipher errors

### Verification

- [x] /verify passes (format, lint, typecheck, unit, integration, e2e, e2e-slow, sp-import, pk-import)

## Summary of Changes

Remediated all Critical, Important, and Suggestion items from the 5-agent review of PR #460 (12 commits, all verification steps green).

- **runAsyncTransaction helper** extracted with best-effort ROLLBACK on COMMIT failure and AggregateError wrapping; fn type widened to `() => T | Promise<T>`; nested transactions rejected at the driver level.
- **SyncProvider** pipeline init no longer swallows rejections (emits `sync:error`) and disposes every partial allocation on unmount/cancel via a single `disposePartial()` over a mutable pipeline record.
- **DataLayer** surfaces `data:error` via a new event type when `initialize()` or `close()` rejects.
- **Coverage**: AggregateError, COMMIT-failure, nested-transaction tests across bun, better-sqlite helper, and expo drivers; SyncProvider cancellation-race and init-error tests; DataLayerProvider init-error test.
- **Cleanups**: `OFFLINE_QUEUE_ID_PREFIX` extracted, `OfflineQueueAdapter.close` narrowed to `Promise<void>`, `isDatabaseAccessible` rethrows unexpected errors instead of masking them as decryption mismatches.
- **Ergonomics**: SyncProvider tests migrated from `await act(() => Promise.resolve())` microtask-flushing to `waitFor` on the assertion of interest.

### Note on the cancelled-flag simplification (Group A suggestion)

The plan proposed replacing the object plus getter pattern with a plain `let cancelled: boolean = false`. In practice the project ESLint config rule `@typescript-eslint/no-unnecessary-condition` narrows the `let` variant to `false` at every check across the await boundaries, even with an explicit `boolean` annotation. The getter pattern was kept as the only reliable way to bypass that narrowing without disabling the rule.
