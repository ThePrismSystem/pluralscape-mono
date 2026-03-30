---
# api-sfa8
title: "PR #330 review fixes"
status: completed
type: task
priority: normal
created_at: 2026-03-30T09:37:32Z
updated_at: 2026-03-30T10:03:19Z
---

Fix all issues from PR #330 review: migrations, Valkey publish failures, heartbeat zombie connections, service logic, test helpers, and test coverage

## Summary of Changes

### Phase 1: Migrations

- Nuked and regenerated PG and SQLite migrations from clean schema
- Regenerated RLS migration (0001_rls_all_tables.sql)

### Phase 2: Surface Valkey Publish Failures

- Added `syncPublished: boolean | null` to `BroadcastResult` interface
- `broadcastDocumentUpdateWithSync` now returns `syncPublished: true/false/null`
- Upgraded publish-false log from debug to warn
- Message router logs warn on `syncPublished === false`
- Added tests for syncPublished values including throw case

### Phase 3: Fix Heartbeat Zombie Connections

- Added optional `onDead` callback to `startHeartbeat` and `HeartbeatState`
- Ping send failure now calls `clearHeartbeat` + `onDead` (stops zombie interval)
- Pong timeout now calls `onDead` after close (whether close throws or not)
- WS index passes `connectionManager.remove` as onDead callback
- Added 4 new heartbeat tests for onDead behavior

### Phase 4: Fix Service Logic and Startup

- 4a: Reject activeOnly + endFrom/endUntil conflict with VALIDATION_ERROR
- 4b: Flattened end-time filter logic (single isNotNull guard)
- 4c: Log warning on pubsub connection failure at startup

### Phase 5: Suggestions

- 5a: Extracted shared WS test helpers (mockWs, createMockLogger re-export)
- 5b: Replaced mutable `routerCtx` with `routerCtxRef.current` ref pattern
- 5c: Documented archive/restore asymmetry (204 vs 200)

### Phase 6: Test Coverage

- Route tests: fronting-reports archive/restore, update; entity-links update
- Validation tests: UpdateFrontingReportBodySchema, UpdateStructureEntityLinkBodySchema, MemberListQuerySchema
- groupId route filter test in member list
- Cursor pagination tests in member-photo service
- setSyncPubSub lifecycle test
