---
# db-2w0v
title: "Fix PR #57 review issues: types, constraints, bugs, tests, docs"
status: completed
type: task
priority: normal
created_at: 2026-03-11T03:08:35Z
updated_at: 2026-03-11T03:30:23Z
---

Address all critical bugs, important issues, and suggestions found in multi-model PR review of PR #57 (docs/db-dialect-strategy). Includes: narrow view types, add CHECK constraints, fix friend request filter direction, fix webhook retry filter, fix FTS5 injection, fix PG type alias, update tests, update docs.

## Summary of Changes

### Phase 1: Types and Exports

- Narrowed `ActiveApiKey.keyType` to `"metadata" | "crypto"`
- Narrowed `PendingWebhookRetry.eventType` to `WebhookEventType`, `.status` to `"failed"`
- Narrowed `ActiveDeviceToken.platform` to `DeviceTokenPlatform`
- Added `accountId` to `ExportRequest` type
- Added `SEARCHABLE_ENTITY_TYPES`, `JOB_TYPES`, `JOB_STATUSES` re-exports from db index

### Phase 2: Schema Constraints

- SQLite import-export: added 6 CHECK constraints + partial unique index on purge requests
- SQLite sync: added 2 CHECK constraints (operation, resolution)
- SQLite jobs: applied CHECK constraints inline, removed dead `jobStatusCheck` export, added type CHECK
- PG import-export: added partial unique index on purge requests
- PG sync: added partial index for unsynced items

### Phase 3: Critical Bug Fixes

- Fixed `getPendingFriendRequests` to filter on `friendSystemId` (receiver) in both PG and SQLite
- Fixed `getPendingWebhookRetries` to include `nextRetryAt <= NOW()` filter in both dialects
- Fixed FTS5 injection vulnerability in `searchEntries` with quote sanitization
- Deduplicated `searchEntries` into a single query path

### Phase 4: Quality Fixes

- Changed `PgDb` type alias from `PgliteDatabase` to `PgDatabase<PgQueryResultHKT>`
- Fixed `::int` overflow to `::bigint` in PG duration calculation
- Fixed PG cross-link timestamps: `created_at: string` with `new Date().getTime()` conversion
- Normalized `now()` casing to `NOW()`

### Phase 5: Shared Mapper

- Created `views/mappers.ts` with `RawCrossLinkRow` and `mapCrossLinkRow`
- Updated both PG and SQLite views to use shared mapper

### Phase 6: Test Updates

- Added `beforeEach` cleanup to PG views test
- Updated friend request + webhook retry tests in both PG and SQLite
- Added 3 new PG view test suites (friend connections, device tokens, device transfers)
- Updated all helper DDL files with CHECK constraints and indexes

### Phase 7: Documentation

- Fixed sync/async `createSearchIndex` in docs
- Fixed `enumCheck` signature in API guide
- Clarified file naming patterns
- Updated webhook retry filter docs
- Added missing RLS scope types
- Fixed PgliteDatabase note and duration cast
