---
# db-vyjk
title: Fix all PR review issues for feat/db-views-query-helpers
status: completed
type: task
priority: normal
created_at: 2026-03-11T02:06:57Z
updated_at: 2026-03-11T02:31:54Z
---

Address 26 issues found in multi-model PR review across 7 phases: types/helpers, SQLite constraints, PG schema fixes, view/query helper fixes, FTS5 search, test DDL updates, test code fixes.

## Summary of Changes

Fixed all 26 PR review issues across 7 phases:

- **Phase 1 (Types/Helpers)**: Added accountId to ExportRequest, hardened enumCheck with regex validation, added JSDoc to enums, added token/LINK_TYPES/mapStructureCrossLinkRow to view types, updated barrel exports
- **Phase 2 (SQLite constraints)**: Added CHECK constraints to jobs, import-export, and sync tables
- **Phase 3 (PG schema)**: Added co-presence constraint to syncConflicts, changed details to TEXT, added chunks/schedule checks to import-export, added default status to accountPurgeRequests
- **Phase 4 (View/query helpers)**: Fixed PG duration overflow with GREATEST, added token to getActiveDeviceTokens, used shared mapStructureCrossLinkRow, fixed PG timestamp conversion
- **Phase 5 (FTS5 search)**: Added escapeFts5Query, wrapped rebuildSearchIndex in transaction, merged duplicate code paths
- **Phase 6 (Test DDL)**: Updated pg-helpers and sqlite-helpers DDL to match all new constraints, exported pgExec
- **Phase 7 (Tests)**: Added beforeEach cleanup to PG views, added empty-result edge cases, added token assertions, added 19 missing enum tests, fixed toBeTruthy assertions
