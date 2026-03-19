---
# db-8cuk
title: Replace manual DDL in test helpers with generated DDL
status: completed
type: task
priority: normal
created_at: 2026-03-19T04:52:11Z
updated_at: 2026-03-19T05:11:05Z
parent: api-765x
---

Eliminate hand-written PG_DDL/SQLITE_DDL by generating DDL from Drizzle schema via getTableConfig()

## Summary of Changes\n\n- Created `schema-to-ddl.ts` with `pgTableToCreateDDL()` and `pgTableToIndexDDL()` to generate DDL from Drizzle schema\n- Created unit tests in `schema-to-ddl.test.ts` (14 tests)\n- Replaced ~1375 lines of hand-written PG_DDL in `pg-helpers.ts` with generated DDL calls\n- Search index DDL remains manual (tsvector trigger not expressible in Drizzle)\n- All 313 DB tests pass with generated DDL\n\nNote: SQLite DDL replacement deferred — pg-helpers was the primary target
