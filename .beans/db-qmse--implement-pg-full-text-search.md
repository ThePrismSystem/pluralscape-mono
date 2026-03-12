---
# db-qmse
title: Implement PG full-text search
status: completed
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T11:24:25Z
parent: db-2nr7
---

SQLite has FTS5 virtual table with helpers. PG has no corresponding implementation — dialect capabilities doc says not yet implemented. All three audit models flagged this as a product gap for hosted PG deployments. Ref: audit H14

## Summary of Changes

- Created packages/db/src/schema/pg/search.ts with PG full-text search using tsvector/tsquery
- Multi-tenant search_index table with system_id scoping
- GENERATED tsvector column with weighted fields (title=A, content=B)
- Functions: createSearchIndex, insertSearchEntry (upsert), deleteSearchEntry, rebuildSearchIndex, searchEntries
- searchEntries uses websearch_to_tsquery for safe input and ts_headline for snippets
- Added search_index to RLS_TABLE_POLICIES (system scope)
- Exported from pg/index.ts
- Added PGlite test helpers with nullable search_vector column (COALESCE fallback)
- 12 integration tests covering search, multi-tenant isolation, ranking, upsert, pagination, special chars
- Updated dialect-capabilities.md with cross-dialect Full-Text Search section
