---
# mobile-zqfj
title: "Fix PR #460 review issues"
status: in-progress
type: task
created_at: 2026-04-16T20:12:09Z
updated_at: 2026-04-16T20:12:09Z
---

Remediate all Critical/Important/Suggestion items from 5-agent review of PR #460 (async SqliteDriver contract). See docs/superpowers/plans/2026-04-16-mobile-shr0-opfs-worker-plan.md for Phase 1 context.

## Todo

### Group A — SyncProvider reliability (Critical)

- [ ] A1/A2 Fix SyncProvider IIFE rejection swallow + partial-init leaks
- [ ] Simplify cancelled flag (drop getter/setter pattern)

### Group B — DataLayer error surface (Important)

- [ ] Add data:error event to event-map
- [ ] Wire DataLayerProvider initialize/close errors through event bus

### Group C — Driver transaction correctness (Important)

- [ ] C1 Extract runAsyncTransaction helper with AggregateError handling
- [ ] C2 Use helper in bun, better-sqlite test helper, expo drivers
- [ ] C3 Broaden fn type to T | Promise<T>
- [ ] C4 Remove stale rollback comments
- [ ] C5 Nested-transaction guard at driver level

### Group D — Type and interface cleanup

- [ ] D1 Narrow OfflineQueueAdapter.close to Promise<void>
- [ ] D2 Remove dead transaction field from BunSqliteDatabase

### Group E — Test coverage (Important)

- [ ] E1 AggregateError test for bun driver
- [ ] E2 AggregateError test for better-sqlite test helper (new file)
- [ ] E3 COMMIT-failure path tests (both)
- [ ] E4 Nested-transaction tests (both)
- [ ] E5 SyncProvider cancellation-race test
- [ ] E6 SyncProvider init-error test
- [ ] E7 DataLayerProvider init-error test

### Group F — Test ergonomics

- [ ] F1 Migrate await act(() => Promise.resolve()) to waitFor in SyncProvider tests

### Group G — Misc cleanups

- [ ] G1 Extract OFFLINE_QUEUE_ID_PREFIX constant
- [ ] G2 Narrow isDatabaseAccessible catch to SQLCipher errors

### Verification

- [ ] /verify passes (format, lint, typecheck, unit, integration, e2e)
