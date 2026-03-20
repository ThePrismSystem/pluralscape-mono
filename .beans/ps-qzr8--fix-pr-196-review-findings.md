---
# ps-qzr8
title: Fix PR 196 review findings
status: completed
type: task
priority: normal
created_at: 2026-03-20T02:46:20Z
updated_at: 2026-03-20T03:06:53Z
---

Implement all fixes from multi-model review of sync infrastructure PR #196: signature columns, lastSeq on snapshots, PgSyncRelayService correctness, WsNetworkAdapter fixes, SyncEngine fixes, compaction handler fixes, type consolidation, and test updates.

## Summary of Changes

Fixed all review findings from PR #196 multi-model review:

**Critical fixes:**

- Added `signature` column to PG and SQLite sync schemas (changes + snapshots)
- Added `lastSeq` to `EncryptedSnapshotEnvelope` to fix bootstrap re-fetch and prune bugs
- Fixed PgSyncRelayService to store/retrieve signatures instead of fabricating empty ones
- Added FOR UPDATE locking in `submitSnapshot()` to prevent TOCTOU races
- Added idempotent dedup (`onConflictDoNothing`) in `submit()`

**Important fixes:**

- SyncEngine: persist before CRDT apply, error-resilient bootstrap, deferred eviction
- WsNetworkAdapter: catch-up handling on subscribe, dispose(), error boundaries
- Compaction handler: partial failure resilience, discriminated union result type
- Type consolidation: re-export from @pluralscape/types, null consistency for manifest fields
- Handler parallelization with Promise.all

**Improvements:**

- SQLite adapter: async methods, shared mapCryptoFields helper
- MockSyncTransport: rejected promise instead of synchronous throw
- pwhash-offload: `as unknown as` instead of `as never`
- Stack-safe maxSeq helper (no spread into Math.max)
