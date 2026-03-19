---
# api-jx0c
title: Add constant-time token comparison for session and biometric auth
status: todo
type: task
priority: high
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M2: Replace standard string comparison with constant-time comparison for session tokens and biometric verification to prevent timing attacks.

## Acceptance Criteria

- All session token comparisons use timingSafeEqual (crypto module)
- All biometric token comparisons use timingSafeEqual
- No === or == used for any security-sensitive token comparison
- Audit: grep codebase for direct string comparison on token fields, fix all instances
- Unit tests: confirm timingSafeEqual is called (mock/spy verification)
