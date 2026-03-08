---
# db-43uo
title: Common views and query helpers
status: todo
type: task
created_at: 2026-03-08T14:23:27Z
updated_at: 2026-03-08T14:23:27Z
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

- `current_fronters` view: SELECT from fronting_sessions WHERE end_time IS NULL AND system_id = ?
- `active_api_keys` view: SELECT from api_keys WHERE revoked_at IS NULL AND account_id = ?
- `pending_friend_requests` view: SELECT from friend_connections WHERE status = 'pending' AND friend_system_id = ?
- `pending_webhook_retries` view: SELECT from webhook_deliveries WHERE status = 'failed' AND attempt_count < 5 AND next_retry_at <= NOW()
- `unconfirmed_acknowledgements` view: SELECT from acknowledgements WHERE confirmed = false AND system_id = ?
- `member_group_summary` view: JOIN group_memberships with groups and members
- Design: PG views for server-side queries; SQLite uses equivalent named query helpers in application code
- Note: views involving encrypted_data have limited server-side utility

## Acceptance Criteria

- [ ] All 6 views defined for PostgreSQL
- [ ] Equivalent query helper functions for SQLite
- [ ] Views tested against both dialects
- [ ] Integration test: verify view results match raw queries

## References

- Audit 002 findings (section F)
