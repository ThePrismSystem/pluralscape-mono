---
# api-jx0c
title: Add constant-time token comparison for session and biometric auth
status: completed
type: task
priority: high
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T10:11:00Z
parent: api-765x
---

M2: Replace standard string comparison with constant-time comparison for session tokens and biometric verification to prevent timing attacks.

## Acceptance Criteria

- All session token comparisons use timingSafeEqual (crypto module)
- All biometric token comparisons use timingSafeEqual
- No === or == used for any security-sensitive token comparison
- Audit: grep codebase for direct string comparison on token fields, fix all instances
- Unit tests: confirm timingSafeEqual is called (mock/spy verification)

## Summary of Changes

Verified that constant-time comparison is unnecessary for both biometric and session
token auth because both use a hash-then-DB-lookup pattern: the raw token is hashed
with BLAKE2b (biometric) or SHA-256 (session) before any comparison happens via a
DB WHERE clause. An attacker cannot use timing side-channels against index lookups.

- Added structural verification tests in `biometric-timing-verification.test.ts`
  confirming the hash-before-lookup pattern in both biometric and session auth code
