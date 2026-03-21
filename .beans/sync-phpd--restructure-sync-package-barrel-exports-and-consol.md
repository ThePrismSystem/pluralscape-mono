---
# sync-phpd
title: Restructure sync package barrel exports and consolidate driver files
status: completed
type: task
priority: normal
created_at: 2026-03-21T04:18:23Z
updated_at: 2026-03-21T04:27:38Z
parent: ps-irrf
---

## Summary of Changes

Implements audit findings S-H1, S-M3, S-M4, S-M6 for the sync package.

**S-H1 (barrel restructuring):** Reduced root barrel from ~130 to ~81 exports by
removing internal-only types (compaction, time-split, storage budget, subscription
filter, on-demand loader, replication profiles, schema types, transport internals).
Added three sub-entry points in package.json exports map:

- `@pluralscape/sync/adapters` for storage/network adapters and SQLite drivers
- `@pluralscape/sync/schemas` for CRDT document schema types
- `@pluralscape/sync/protocol` for full protocol message taxonomy

**S-M3 (parseDocumentId simplification):** Replaced the 42-line switch statement
with a direct return using PREFIX_CONFIGS lookup values plus an EntityIdForDocType
mapping for branded ID casting. Eliminates redundant per-case construction.

**S-M4 (delete schemas/index.ts):** Deleted the unused schemas barrel file.
Updated the schemas test to import directly from individual schema modules.

**S-M6 (consolidate SQLite drivers):** Merged bun-sqlite-driver.ts (47 lines)
into sqlite-driver.ts, keeping SqliteDriver/SqliteStatement interfaces alongside
createBunSqliteDriver factory. Deleted bun-sqlite-driver.ts and updated
adapters/index.ts re-exports.

Also deleted unused factories/index.ts and strategies/index.ts barrel files.
