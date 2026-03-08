---
# db-43uo
title: Common views and query helpers
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:23:27Z
updated_at: 2026-03-08T19:32:27Z
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
