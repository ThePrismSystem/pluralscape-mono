---
# ps-t8sz
title: Fix PR review findings for lifecycle event archival
status: completed
type: task
priority: normal
created_at: 2026-03-23T03:07:17Z
updated_at: 2026-03-23T04:05:32Z
---

Address all review findings from PR #242: critical DB audit enum bug, 409 CONFLICT for wrong-state archive/restore, missing tests, migration regeneration, and minor fixes.

## Summary of Changes

### Critical: DB audit enum missing lifecycle event types

- Added `lifecycle-event.archived`, `lifecycle-event.restored`, `lifecycle-event.deleted` to `AUDIT_EVENT_TYPES` in `packages/db/src/helpers/enums.ts`
- Regenerated migration 0003 for both PG and SQLite — now includes `audit_log_event_type_check` constraint update
- Fixed PG migration to use 3-step backfill for `updated_at` column (nullable → backfill → NOT NULL)
- Fixed SQLite migration INSERT...SELECT to use `recorded_at` as source for `updated_at` backfill

### Important: 409 CONFLICT for wrong-state archive/restore

- Updated `entity-lifecycle.ts`: after UPDATE returns 0 rows, does a SELECT to distinguish 'not found' (404) from 'wrong state' (409 ALREADY_ARCHIVED / NOT_ARCHIVED)
- Added `ALREADY_ARCHIVED` and `NOT_ARCHIVED` to `ApiErrorCode` in `packages/types/src/api-constants.ts`
- Added tests for both new error paths in `entity-lifecycle.test.ts`

### Tests added

- Route tests for `includeArchived=true` forwarding and invalid value rejection (400)
- DB integration tests for `version < 1` CHECK constraint (PG and SQLite)
- Fixed service test fixture using invalid state (`archived: true` with `archivedAt: null`)

### Minor fixes

- Removed redundant `as const` assertions in `LIFECYCLE_EVENT_LIFECYCLE` config
- Added `required: false` to OpenAPI `includeArchived` query parameter
- Updated DB enum count test from 102 to 105
