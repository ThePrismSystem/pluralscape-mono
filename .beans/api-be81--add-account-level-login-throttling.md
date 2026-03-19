---
# api-be81
title: Add account-level login throttling
status: todo
type: task
priority: high
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M1: Implement per-account rate limiting for failed login attempts to prevent brute-force attacks.

## Acceptance Criteria

- Throttle after 10 failed login attempts within 15-minute window per account
- Counter increments on wrong password only, not on account-not-found
- Counter resets to zero on successful login
- Rate limit is per-account, independent of source IP
- Returns 429 with Retry-After header when throttled
- Integration tests: brute-force simulation (11 attempts), reset-on-success, IP-independence
