---
# ps-vlt4
title: "Fix PR #89 review findings"
status: completed
type: task
priority: high
created_at: 2026-03-13T22:21:40Z
updated_at: 2026-03-13T22:39:45Z
---

Fix 5 critical, 9 important, and 5 suggestion issues found in PR #89 multi-model review across types, DB schema, RLS, and tests.

## Summary of Changes

### Phase 1: Types Package

- Added `InnerWorldEntityType` extracted type to `innerworld.ts`
- Fixed `InnerworldMoveEvent.entityId` to use `InnerWorldEntityId` and `entityType` to use `InnerWorldEntityType`
- Fixed `snapshot.ts`: changed `KnownSaturationLevel` to `SaturationLevel`, expanded `SnapshotTrigger` to include `scheduled-daily`/`scheduled-weekly`, moved `name`/`description` from `SystemSnapshot` to `SnapshotContent`, used `InnerWorldEntityType` for entity types
- Added `keyVersion: number` to `KeyGrant` in `privacy.ts`
- Renamed `SPImportFriend.friendAccountId` to `externalFriendId` with JSDoc
- Made `FrontingSnapshotEntry` a discriminated union with `kind: "member" | "custom-front"`
- Expanded `snapshotSchedule` JSDoc to document client-triggered zero-knowledge behavior
- Nested outtrigger fields into `outtrigger: { reason, sentiment } | null`
- Renamed `FriendNotificationPreference.systemId` to `accountId`
- Added `@future` JSDoc to `SystemListItem` and `SystemDuplicationScope`
- Updated barrel exports in `index.ts`

### Phase 2: DB Schema

- Fixed `friendNotificationPreferences` composite FK: renamed `system_id` to `account_id`, references `accounts.id`
- Renamed `trigger` column to `snapshot_trigger` in both PG and SQLite snapshots schemas
- Expanded `SNAPSHOT_TRIGGERS` enum to 3 values
- Fixed RLS policies: `friend_connections`, `friend_codes`, `friend_notification_preferences` → `account` scope; added `system_snapshots` → `system` scope

### Phase 3: Test Helpers

- Added `account_type` to accounts DDL in both PG and SQLite helpers
- Fixed `friend_notification_preferences` DDL to use `account_id`
- Added `system_snapshots` DDL and `createPg/SqliteSnapshotTables` helpers
- Fixed `lifecycle_events` CHECK constraint to include `structure-move` and `innerworld-move`

### Phase 4: Test Fixes

- Fixed RLS test data to use `accountId` for `friend_account_id`
- Updated notification integration tests to use `accountId` instead of `systemId`
- Added `LIFECYCLE_EVENT_TYPES` and `SNAPSHOT_TRIGGERS` tests to enums test
- Updated type tests for privacy, lifecycle, import-export, fronting, and notifications

### Phase 5: New Tests

- Created `snapshot.test.ts` covering all 12 exported snapshot types
- Created `schema-pg-snapshots.integration.test.ts` and `schema-sqlite-snapshots.integration.test.ts`

### Verification

- `pnpm typecheck` — clean (8/8)
- `pnpm lint` — clean (7/7)
- `pnpm test` — 144 test files, 2514 tests passed
