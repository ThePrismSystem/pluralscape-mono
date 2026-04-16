---
# db-txln
title: Fix PR review issues for import/sync tables
status: completed
type: task
priority: normal
created_at: 2026-03-10T10:41:38Z
updated_at: 2026-04-16T07:29:39Z
parent: ps-vtws
---

Fix all 4 critical, 10 important, and 5 suggestion-level issues from multi-model PR review

## Summary of Changes

- Fixed SQL injection in `enumCheck` helper (`sql.raw` -> `sql.join` with parameterized values)
- Fixed `pgJsonb` to handle PGlite's auto-deserialized objects (prevents double-parse crash)
- Fixed TypeScript type/schema mismatches: `SyncDocument`, `SyncConflict`, `ImportJob`, `ExportRequest`, `AccountPurgeRequest`
- Replaced drizzle-orm `jsonb` import with custom `pgJsonb` in PG import-export schema
- Changed `sync_conflicts.details` from `varchar(65535)` to `text` in PG schema
- Added `updatedAt` column to `exportRequests` (both PG and SQLite)
- Added `default('pending')` to `accountPurgeRequests.status` (both PG and SQLite)
- Added chunks CHECK constraint to PG `importJobs`
- Added composite index on `sync_queue(system_id, entity_type, entity_id)` (both PG and SQLite)
- Added all CHECK constraints to SQLite schemas (source, status, format, operation, resolution, progress range, chunks bound)
- Synced test helper DDL to match schema changes (both PG and SQLite)
- Added 3 missing branded ID types to `ids.test.ts` and updated count to 58
- Added 9 SQLite rejection tests and 8 status-value coverage tests across all 4 test files
