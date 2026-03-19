---
# api-kxk7
title: Rate limiting for transfer initiation
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-19T11:39:42Z
parent: crypto-og5h
---

Per-account rate limit for device transfer initiation (e.g., 3 per hour).

## Acceptance Criteria

- First 3 initiations within 1 hour succeed
- 4th initiation within window → 429 Too Many Requests
- Rate limit is per-account, not per-IP (prevents distributed attacks)
- Rate limit window configurable in constants file
- Rate limit resets after window expires
- Unit tests: simulate 4 rapid initiations, verify 429 on 4th
