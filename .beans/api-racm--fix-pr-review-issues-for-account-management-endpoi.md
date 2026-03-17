---
# api-racm
title: Fix PR review issues for account management endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-17T07:18:51Z
updated_at: 2026-03-17T07:19:00Z
parent: api-o89k
---

Address all 12 issues from PR review: ConcurrencyError 409, emailSalt JSDoc, encrypted-payload length guard and tests, validation schema tests, password min-length consolidation, timing oracle fix, branded types, memzero assertions, stronger Zod assertions, route-level ConcurrencyError tests

## Summary of Changes

All 12 PR review issues addressed:

1. ConcurrencyError now returns 409 CONFLICT (not 500) in both route handlers
2. emailSalt JSDoc added explaining future per-account salting intent
3. deserializeEncryptedPayload length guard (nonce + tag minimum)
4. encrypted-payload.test.ts: roundtrip, length guard, split correctness tests
5. memzero assertions: extracted mockMemzero, verified 3 calls on success, 3 on tx failure, 0 on null key
6. Branded types (AccountId, SessionId, SystemId, UnixMillis) at service boundary
7. Static import for systems table (removed dynamic import)
8. Password min-length consolidated into Zod schema via validation.constants.ts
9. Email unchanged check returns silent ok (timing oracle fix)
10. Validation schema tests (ChangeEmailSchema, ChangePasswordSchema)
11. Route-level ConcurrencyError tests for both endpoints
12. Stronger Zod error assertions (check name: ZodError)
