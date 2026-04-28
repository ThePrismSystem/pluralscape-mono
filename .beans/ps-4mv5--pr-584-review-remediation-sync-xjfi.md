---
# ps-4mv5
title: "PR #584 review remediation (sync-xjfi)"
status: completed
type: task
priority: normal
created_at: 2026-04-28T21:03:38Z
updated_at: 2026-04-28T21:44:59Z
---

Address all critical, important, and suggestion findings from the multi-agent review of PR #584 per plan at .claude/plans/woolly-roaming-nova.md. 9 commits planned.

## Implementation checklist

- [x] Commit 1 — fix(sync): brand documentId in event-map (I2) [3aae5dc4]
- [x] Commit 2 — refactor(sync): tighten MaterializerDb param types (I6) [5eeeea17]
- [x] Commit 3+4 — refactor(sync, data): move transaction wrap to subscriber, F1 NoActiveSessionError handling, I3 sync:error on materialize throw, S2/S4/S5/S8 cleanup [2dad9123]
- [x] Commit 5 — refactor(mobile): discriminated PlatformStorage + isSqliteBackend helper (I7) [b9ad1bc4]
- [x] Commit 6 — fix(mobile): SyncProvider catch clears engine state + comment + ref consolidation + bus inlining (I4 + S6 + S10 + S11) [ca9e5dd7]
- [x] Commit 7 — fix(mobile): logger.warn on SQLCipher wipe (I5) [15195bbb]; S7 (runStatement) skipped — see commit body
- [x] Commit 8 — docs(mobile): reworded adapter transaction JSDoc (I1 docs + S3) [folded into commit 5eeeea17]
- [x] Commit 9 — test: branch coverage, disposal-order, lock/unlock, registry isolation (S1 + S12)

Plan reference: /home/theprismsystem/.claude/plans/woolly-roaming-nova.md

## Summary of Changes

Addresses all critical, important, and suggestion findings from the multi-agent review of PR #584. 7 commits on top of the 7 sync-xjfi commits already on the branch:

- **3aae5dc4** — I2: brand `documentId` on `SyncChangesMergedEvent` / `SyncSnapshotAppliedEvent`; reword `dirtyEntityTypes` JSDoc.
- **5eeeea17** — I6: tighten `MaterializerDb.queryAll` / `execute` to `readonly MaterializerBindValue[]`; add `toBindValue` runtime guard. Drop `as SQLiteBindParams` casts in the expo-sqlite adapter.
- **2dad9123** — F1 + I1 + I3 + S2 + S4 + S5 + S8: subscriber wraps `engine.getDocumentSnapshot` in try/catch (silent skip on `NoActiveSessionError`, `sync:error` on anything else); wraps `materializer.materialize` in `materializerDb.transaction(...)` for true per-merge atomicity (transaction wrap removed from `applyDiff`); emits `sync:error` on materializer write failure; renames `materialise` → `materialize`; drops `isRecordSnapshot`.
- **b9ad1bc4** — I7: replace `materializerDb: MaterializerDb | null` with discriminated `PlatformStorage` union (`sqlite-sync` | `sqlite-async` | `indexeddb`); add `isSqliteBackend` type guard. All consumers (DataLayerProvider, useQuerySource, SyncProvider, fixtures) propagated.
- **ca9e5dd7** — I4 + S6 + S10 + S11: SyncProvider catch branch now mirrors success path (`setEngine(null)` + `setIsBootstrapped(false)`); ref clears consolidated to single source of truth; `bus` alias inlined.
- **15195bbb** — I5: `logger.warn` on the SQLCipher wipe path before `deleteDatabaseSync`. S7 (runStatement helper) skipped — TRow generic preservation made the deduped helper less clear than the duplication.
- **da9c591a** — S1 + S12: branch coverage tests for F1/I1/I3 paths in materializer-subscriber; queryAll-throw test in materializer-db-adapter; subscriber-disposal-order, lock→unlock re-creation, and SyncEngine-construction-throw tests in SyncProvider; materializer registry save+restore isolation in `beforeEach`/`afterEach`.

## Test counts

- Unit: 13147 passed (+~17 new tests)
- Integration: 3060 passed
- E2E: 507 passed (2 skipped)

## Out of scope

- S9 (shared `makeMockMaterializerDb` fixture in `tooling/test-utils`) deferred — current duplication is small (one fn each in two test files) and lifting now would require a publishing change to test-utils. Worth revisiting only if a third caller appears.
- Option B for I6 (tighten `EntityRow` value type to `MaterializerBindValue`) — too invasive across all materializers; chosen Option A (`toBindValue` boundary guard) instead.
