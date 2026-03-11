---
# db-8zot
title: "Fix PR #55 review issues: FTS5, jobs, sync, import-export"
status: completed
type: task
priority: normal
created_at: 2026-03-11T01:00:53Z
updated_at: 2026-03-11T01:06:16Z
---

Address all review findings from PR #55 (FTS5 search index and SQLite job queue tables). Includes schema fixes, test helper DDL updates, test improvements, and documentation.

## Summary of Changes

Phase 1 - Schema source fixes:

- jobs.ts: Added type CHECK (JOB_TYPES) and attempts <= max_attempts CHECK, removed dead jobStatusCheck export
- search.ts: Marked entity_type UNINDEXED, added sanitizeFtsQuery helper, consolidated searchEntries, replaced unsafe cast with runtime validation
- pg/sync.ts + sqlite/sync.ts: Replaced TODO with partial index on synced_at IS NULL, added version >= 1 CHECK, added ordering comment
- pg/import-export.ts + sqlite/import-export.ts: Added blobId orphan and purge uniqueness documentation
- pg.ts: Fixed pgJsonb driverData generic from string to unknown
- index.ts: Added SEARCHABLE_ENTITY_TYPES, JOB_TYPES, JOB_STATUSES barrel exports
- check.ts: Added documentation comment about DDL value inlining

Phase 2 - Test helper DDL:

- sqlite-helpers.ts: Added jobs type CHECK, attempts CHECK, sync_documents version CHECK, sync_queue partial index
- pg-helpers.ts: Added sync_documents version CHECK, sync_queue partial index

Phase 3 - Test improvements:

- All 5 test files: Added afterEach cleanup
- PG + SQLite import-export: Fixed toBeTruthy, added chunks/blob/purge tests, it.each refactor
- PG + SQLite sync: Added version/lifecycle tests, it.each refactor
- SQLite jobs: Added type/attempts CHECK tests, fixed autoincrement assertion
- SQLite search: Added FTS5 safety tests and sanitizeFtsQuery unit tests
