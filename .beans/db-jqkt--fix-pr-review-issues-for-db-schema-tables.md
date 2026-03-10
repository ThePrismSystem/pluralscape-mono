---
# db-jqkt
title: Fix PR review issues for db schema tables
status: completed
type: task
priority: normal
created_at: 2026-03-10T02:06:54Z
updated_at: 2026-03-10T02:23:54Z
---

Fix self-friendship CHECK, add missing indexes, DDL helpers, extract insert helpers, add negative tests per review plan

## Summary of Changes

### Phase 1: Schema Changes

- Added `friend_connections_no_self_check` CHECK constraint to both PG and SQLite privacy schemas
- Added `friend_connections_friend_system_id_idx` and `bucket_content_tags_bucket_id_idx` indexes to both dialects
- Added documentation comments for intentional design decisions (directional friendships, sortOrder ties, membership uniqueness)

### Phase 2: DDL Helper Changes

- Added 24+ index DDL strings to both PG and SQLite test helpers
- Added CHECK constraint to friendConnections DDL
- Extracted `createPgBaseTables`/`createSqliteBaseTables` for DRY setup
- Added `pgInsertAccount`/`pgInsertSystem` and `sqliteInsertAccount`/`sqliteInsertSystem` shared helpers
- Added `pgExec` helper for multi-statement SQL in PGlite

### Phase 3: Test Refactoring

- Replaced inline `insertAccount`/`insertSystem` with shared helpers across 12 test files (6 PG + 6 SQLite)

### Phase 4: New Tests

- Self-friendship rejection tests (PG + SQLite)
- friendCodes CHECK boundary tests (expiresAt === createdAt)
- FK violation negative tests across privacy, structure, and custom fields (both dialects)
- Cross-link cascade tests for second FK direction (subsystemLayerLinks, subsystemSideSystemLinks, sideSystemLayerLinks)

All 1248 tests pass. Typecheck, lint, and format all clean.
