---
# sync-qmse
title: Sync engine runtime hardening (P-M1,M2,M3,M4,M5,M8)
status: completed
type: task
created_at: 2026-03-21T03:24:30Z
updated_at: 2026-03-21T03:34:00Z
parent: ps-irrf
---

## Summary of Changes

Implemented 6 findings from the M3 comprehensive audit:

- **P-M1** (sync-session.ts): Batch Automerge change application. Decrypts all
  changes into an array first, then applies via single `Automerge.applyChanges`
  call. Preserves rollback semantics on crypto failure.
- **P-M2** (sync-engine.ts): Skip redundant hydration. Compares local snapshot
  version and max seq against manifest; skips `fetchLatestSnapshot` and
  `fetchChangesSince` when local state matches or exceeds server.
- **P-M3** (sqlite-storage-adapter.ts): Batch storage writes via `appendChanges`
  method wrapping all inserts in a single SQLite transaction. Fallback to
  individual `appendChange` calls for adapters without it.
- **P-M4** (sync-engine.ts): Clean up resolved operation promises. After
  `enqueueDocumentOperation` resolves, deletes the map entry if the stored
  promise still matches (identity check to avoid races).
- **P-M5** (sync-engine.ts): Cap conflict retry buffer at 100 entries. Drops
  oldest entries and logs warning when exceeded.
- **P-M8** (sync-engine.ts): Use `mapConcurrent` with concurrency limit of 5
  for correction envelope submission/persistence instead of unbounded
  `Promise.allSettled`.

Added 12 new tests covering all findings plus 3 contract tests for batch
`appendChanges`. All 5395 tests pass.
