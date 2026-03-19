---
# api-wxi1
title: Move session revocation check inside transaction WHERE clause
status: todo
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-19T11:39:43Z
parent: api-765x
---

L7: Combine the existence check and revocation into a single atomic WHERE clause instead of separate queries.

## Acceptance Criteria

- Session revocation uses single UPDATE ... WHERE id = ? AND revoked_at IS NULL
- No separate SELECT before UPDATE (atomic check-and-revoke)
- Concurrent revocation attempts are safe (second attempt is a no-op, not an error)
- Already-revoked session → appropriate response (not found or already revoked)
- Integration tests: concurrent revocation safe; revoked session → 401 on next use
