---
# api-uvp1
title: Anti-enumeration timing for all auth endpoints
status: todo
type: task
priority: high
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M7: Ensure consistent response timing across all auth endpoints (login, register, password reset) to prevent user enumeration.

## Acceptance Criteria

- Auth endpoints respond in constant time regardless of whether email/account exists
- Implementation: minimum response floor OR full hash computation on not-found path
- Applies to: login, register, password reset, email verification endpoints
- Timing delta between exists/not-exists within acceptable variance (< 10ms difference)
- Unit tests: verify both paths execute equivalent work (hash or delay)
