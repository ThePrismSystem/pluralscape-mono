---
# db-43uo
title: Common views and query helpers
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:23:27Z
updated_at: 2026-03-10T10:06:24Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
  - db-82q2
  - db-3h1c
  - db-7er7
  - db-ju0q
---

PostgreSQL views and dialect-agnostic query helpers for common access patterns.

## Scope

### Views (PostgreSQL) / Query helpers (SQLite)

- **`current_fronters`**: `SELECT * FROM fronting_sessions WHERE end_time IS NULL AND system_id = ?`
- **`current_fronters_with_duration`**: extends current_fronters with `(NOW() - start_time) AS duration`
- **`active_api_keys`**: `SELECT * FROM api_keys WHERE revoked_at IS NULL AND account_id = ?`
- **`pending_friend_requests`**: `SELECT * FROM friend_connections WHERE status = 'pending' AND friend_system_id = ?`
- **`pending_webhook_retries`**: `SELECT * FROM webhook_deliveries WHERE status = 'failed' AND attempt_count < ? AND next_retry_at <= NOW()` — uses configurable threshold parameter, not hardcoded
- **`unconfirmed_acknowledgements`**: `SELECT * FROM acknowledgements WHERE confirmed = false AND system_id = ?`
- **`member_group_summary`**: JOIN group_memberships with groups and members
- **`active_friend_connections`**: `SELECT * FROM friend_connections WHERE status = 'accepted' AND system_id = ?`
- **`active_device_tokens`**: `SELECT * FROM device_tokens WHERE revoked_at IS NULL AND account_id = ?`

Note: `current_fronters_with_duration` uses PG `NOW()`. SQLite equivalent: `(strftime('%s','now') * 1000 - start_time)`

### Design decisions

- PG views for server-side queries; SQLite uses equivalent named query helpers
- Views involving encrypted_data have limited server-side utility
- pending_webhook_retries uses a parameter for max attempts, allowing per-deployment configuration

## Acceptance Criteria

- [ ] All 9 views/helpers defined for PostgreSQL
- [ ] current_fronters_with_duration includes computed duration
- [ ] pending_webhook_retries uses configurable threshold
- [ ] Equivalent query helper functions for SQLite
- [ ] Views tested against both dialects
- [ ] Integration test: verify view results match raw queries

## References

- Audit 002 findings (section F)

### Additional views (from audit 003)

- **`current_fronting_comments`**: `SELECT fc.* FROM fronting_comments fc JOIN fronting_sessions fs ON fc.session_id = fs.id WHERE fs.end_time IS NULL AND fs.system_id = ?`
- **`active_device_transfers`**: `SELECT * FROM device_transfer_requests WHERE status = 'pending' AND expires_at > NOW() AND account_id = ?`
- **`structure_cross_links`**: UNION view of subsystem_layer_links, subsystem_side_system_links, side_system_layer_links for unified structure relationship queries

## Summary of Changes

Implemented 12 query helper functions as "views" for both PostgreSQL and SQLite dialects:

1. `getCurrentFronters` — active fronting sessions (end_time IS NULL)
2. `getCurrentFrontersWithDuration` — active sessions with computed duration in ms
3. `getActiveApiKeys` — non-revoked API keys
4. `getPendingFriendRequests` — pending friend connections
5. `getPendingWebhookRetries` — failed webhook deliveries under max attempts
6. `getUnconfirmedAcknowledgements` — unconfirmed acknowledgements
7. `getMemberGroupSummary` — groups with member counts
8. `getActiveFriendConnections` — accepted friend connections
9. `getActiveDeviceTokens` — non-revoked device tokens
10. `getCurrentFrontingComments` — comments on active fronting sessions
11. `getActiveDeviceTransfers` — pending non-expired device transfers
12. `getStructureCrossLinks` — UNION of all 3 structure link tables

Files added:

- `packages/db/src/views/types.ts` — 12 shared result type interfaces
- `packages/db/src/views/pg.ts` — PG query helpers using PgliteDatabase
- `packages/db/src/views/sqlite.ts` — SQLite query helpers using BetterSQLite3Database
- `packages/db/src/views/index.ts` — barrel exports
- Integration tests for both dialects (9 PG tests, 12 SQLite tests)
