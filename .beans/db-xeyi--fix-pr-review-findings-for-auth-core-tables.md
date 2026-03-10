---
# db-xeyi
title: Fix PR review findings for auth-core-tables
status: completed
type: task
priority: normal
created_at: 2026-03-10T00:15:17Z
updated_at: 2026-03-10T01:03:16Z
---

Fix all critical, important, and suggestion-level issues from the multi-model PR review of feat/auth-core-tables.

## Summary of Changes

### Schema Fixes

- Added `onDelete: cascade` to `deviceTransferRequests` session FK references (both PG and SQLite)
- Added `.$type<AuthKeyType>()` and `.$type<DeviceTransferStatus>()` narrowing on enum columns
- Created `enumCheck()` helper to generate CHECK SQL from enum arrays, replacing hardcoded strings
- Added composite index `sessions_revoked_last_active_idx` on `(revoked, lastActive)`
- Added index `systems_account_id_idx` on `(accountId)` — converted systems to 3-arg table form
- Added composite index `device_transfer_requests_status_expires_idx` on `(status, expiresAt)`
- Removed redundant `member_photos_member_id_idx` index (covered by composite)
- Added JSDoc on `systems.encryptedData` (nullable rationale) and `memberPhotos.systemId` (denormalization)

### Type Alignment

- `Session.deviceInfo`: changed to `DeviceInfo | null`
- `Session.lastActive`: changed to `UnixMillis | null`
- `DeviceTransferRequest`: added `accountId: AccountId`

### Inferred Types

- Exported `InferSelectModel`/`InferInsertModel` row types for all 8 tables from both PG and SQLite index files

### Factory Fixes

- Changed timestamp type from `Date` to `number` (UnixMillis) in member and system factories
- Added `updatedAt` field defaulting to same value as `createdAt`

### Test Infrastructure

- Created shared DDL helpers: `pg-helpers.ts` and `sqlite-helpers.ts` with table creation functions
- Updated all 6 test files to use shared DDL helpers
- Updated test DDL to match schema changes (cascades, indexes)

### New Tests (30+ added across 6 files)

- Boundary: `expiresAt === createdAt` rejected
- Status acceptance: `approved` and `expired` values
- FK rejection tests for all tables
- Session cascade on `deviceTransferRequests`
- Duplicate primary key rejection
- Empty `Uint8Array(0)` binary round-trip
- NOT NULL enforcement on `auth_keys`
- `memberPhotos.version` defaults to 1
- `archived: true` with `archivedAt` round-trip
- UPDATE round-trip for member `version` and `updatedAt`
- Regex assertion patterns on SQLite error tests

### Other

- Restored `.npmrc` settings, dropped redundant `shamefully-hoist=false`
- Fixed types package tests for nullable Session fields and new DTR accountId
- Removed stale `test-cascade.ts` from repo root
