---
# sync-xjfi
title: Wire materializerRegistry.materialize into data-layer write path
status: completed
type: task
priority: normal
created_at: 2026-04-21T03:02:54Z
updated_at: 2026-04-28T20:26:14Z
parent: ps-cd6x
---

PR #531 added dirtyEntityTypes scaffolding to materializeDocument / materializer.materialize(), but no production code invokes either — the materializer is only exercised in tests. Wire into the production data-layer write path (likely in @pluralscape/data or wherever materialized:document events should be emitted). Until done, the sync-f4ma perf gain is unreachable.

## Summary of Changes

- Extended `SyncChangesMergedEvent` with `dirtyEntityTypes: ReadonlySet<SyncedEntityType>` so subscribers can use the perf gain from sync-f4ma.
- Updated both engine emit sites in `SyncEngine.applyEncryptedChanges` and `mergeChangesEnvelope` to forward the dirty set already computed locally.
- Added `createMaterializerSubscriber({engine, materializerDb, eventBus})` in `@pluralscape/data`. Subscribes to `sync:changes-merged` and `sync:snapshot-applied`; calls `engine.getDocumentSnapshot`, looks up the registered materializer, runs it. Skips silently when the snapshot is evicted or no materializer is registered.
- Built a `MaterializerDb` adapter over expo-sqlite's sync APIs in `apps/mobile/src/data/materializer-db-adapter.ts` — wraps `prepareSync`/`executeSync`/`finalizeSync` and `withTransactionSync`.
- Refactored `createExpoSqliteDriver` to also expose a `materializerDb` adapter sharing the same SQLCipher connection. Threaded `materializerDb: MaterializerDb | null` through the platform storage type.
- Wired the subscriber inside `SyncProvider.tsx` alongside the engine, with proper dispose order on auth-state transitions and unmount.
- Added a smoke test in `SyncProvider.test.tsx` proving the subscriber is wired (engine.getDocumentSnapshot → registered materializer.materialize) and disposed correctly.
- All `/verify` gates pass (format, lint, typecheck, types:check-sot, unit, integration, e2e — 13136 unit, 3060 integration, 507 e2e).
