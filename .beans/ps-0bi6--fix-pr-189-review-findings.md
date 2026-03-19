---
# ps-0bi6
title: 'Fix PR #189 review findings'
status: completed
type: task
priority: normal
created_at: 2026-03-19T05:40:39Z
updated_at: 2026-03-19T05:54:36Z
---

Address all review findings from PR #189: 4 bug fixes, 5 test gaps, and 6 simplifications


## Summary of Changes

- **Double-signal shutdown guard**: Added `shuttingDown` flag to prevent re-entrant SIGTERM/SIGINT handling
- **Pool leak fix**: Wrapped `shutdown()` in try/finally so `raw.end()` runs even if `server.stop()` throws
- **Float equality fix**: Cast `EXTRACT(EPOCH FROM ...)` to `::bigint` in session idle filter SQL; extracted shared expression
- **Stale rawClient fix**: Changed `setDbForTesting` to always reset `cachedRawClient` via `?? null`
- **getDb() tests**: Added deduplication and error recovery tests with mocked `createDatabaseFromEnv`
- **v1 route tests**: Added account and systems route mounting tests
- **Test simplifications**: Merged walker helpers, parameterized access-log method tests, removed duplicate test, cleaned up shutdown afterEach
- **DDL uniformity**: Converted 5 remaining `ddlWithIndexes()` calls to split `pgTableToCreateDDL` + `indexDDL` pattern
- **StructuralPair interface**: Extracted repeated 7-property inline type
- **escapeDefault cleanup**: Replaced unreachable branch with explicit type narrowing
