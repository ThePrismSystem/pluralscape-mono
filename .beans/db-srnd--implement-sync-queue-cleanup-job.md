---
# db-srnd
title: Implement sync-queue-cleanup job
status: completed
type: task
priority: normal
created_at: 2026-03-12T20:22:58Z
updated_at: 2026-03-12T23:51:44Z
---

Implement the sync-queue-cleanup background job: delete synced items older than N days. Job type already exists in packages/types/src/jobs.ts.

## Summary of Changes

Implemented sync-queue-cleanup query functions:

- `pgCleanupSyncedEntries`: PG variant using `NOW() - INTERVAL` for date arithmetic
- `sqliteCleanupSyncedEntries`: SQLite variant using epoch-ms cutoff
- Both delete synced entries older than the specified threshold, skipping unsynced entries
- Integration tests: 3 PG tests + 3 SQLite tests covering deletion, empty table, and unsynced preservation

## Summary of Changes

Implemented sync-queue-cleanup query functions (pgCleanupSyncedEntries, sqliteCleanupSyncedEntries) with 6 integration tests.
