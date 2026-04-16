---
# db-4kcl
title: Fix PR review issues for schema hardening batch 4
status: completed
type: task
priority: normal
created_at: 2026-03-12T11:49:27Z
updated_at: 2026-04-16T07:29:37Z
parent: db-2nr7
---

Address 2 critical bugs, 8 important issues, and 5 suggestions from PR #75 review. Includes: parseSearchableEntityType validation, dead export removal, VARCHAR fix, rebuildSearchIndex fix, GIN sargability fix with PGlite trigger, limit clamping, result mapping validation, doc fixes, and RLS test coverage.

## Summary of Changes

- Added `parseSearchableEntityType` runtime validation helper in `helpers/enums.ts`
- Removed dead `SEARCH_INDEX_TEST_DDL` and `SEARCH_INDEX_TEST_INDEXES_DDL` exports from `pg/search.ts`
- Fixed VARCHAR(255) to VARCHAR(50) in search_index DDL (consistent with ID_MAX_LENGTH)
- Fixed `rebuildSearchIndex` to also recreate indexes after table rebuild
- Fixed GIN index sargability by adding PGlite trigger to auto-populate `search_vector`, removing COALESCE from WHERE clause
- Added limit/offset clamping in both PG and SQLite search modules
- Replaced unsafe `as SearchableEntityType` casts with `parseSearchableEntityType` validation
- Fixed swallowed catch in search integration tests
- Added `search_index` to RLS coverage test
- Fixed ADR 018 column count, added audit-log VARCHAR width comments, added enum source breadcrumb in migration
- Created follow-up bean db-vn6b for branded ID types
