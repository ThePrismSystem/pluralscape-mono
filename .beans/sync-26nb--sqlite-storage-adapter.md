---
# sync-26nb
title: SQLite storage adapter
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T01:23:14Z
parent: sync-qxxo
---

Implement \`SyncStorageAdapter\` for mobile client using SQLite.

## Acceptance Criteria

- Passes all contract tests in \`packages/sync/src/**tests**/storage-adapter.contract.ts\`
- loadChangesSince returns changes after given seq for a document
- appendChange persists change envelope with correct seq
- pruneChangesBeforeSnapshot removes changes below snapshot version
- listDocuments returns all known document IDs
- deleteDocument removes all changes and snapshots for a document
- Works with both Bun SQLite and expo-sqlite (or compatible interface)

## Summary of Changes

- Created SqliteDriver interface (minimal abstraction for bun:sqlite and expo-sqlite)
- Created createBunSqliteDriver wrapper for bun:sqlite
- Implemented SqliteStorageAdapter passing all contract tests (15 tests)
- Added bun-sqlite.d.ts ambient types for tsc compatibility
