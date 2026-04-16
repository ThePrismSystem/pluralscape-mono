---
# api-efry
title: Fix all PR review issues for push notifications
status: completed
type: task
priority: high
created_at: 2026-03-27T20:02:07Z
updated_at: 2026-04-16T07:29:49Z
parent: api-nie2
---

Address all 22+ issues from multi-model PR review: security bugs, logic errors, missing test coverage, type safety gaps, and code quality improvements.

## Summary of Changes

Fixed all 22+ issues from multi-model PR review:

**Critical fixes:**

- Cross-tenant device token takeover: upsert now reassigns ownership + clears revokedAt
- Dispatcher missing top-level try/catch: entire function body wrapped for fire-and-forget contract
- Wrong accountId in preference queries: reverse connection lookup with LEFT JOIN
- Missing config = silent no-op: treat missing config row as enabled by default
- Dispatcher never called: wired into fronting session create route via queue singleton

**Important fixes:**

- Record<string, unknown> -> Partial<typeof table.$inferInsert> for type safety
- TOCTOU race: updateNotificationConfig now auto-creates if no row exists
- N+1 queries: batched all per-friend queries (bucket, visibility, tokens)
- Dead updateLastActive removed; PushPayload derived from job type
- DeviceToken type: added accountId, fixed lastActiveAt nullability
- JOB_TYPES +3 missing entries, AUDIT_EVENT_TYPES +2 missing entries
- FK constraint in friend preference getOrCreate -> 404 instead of 500
- RLS bypass documented in push worker

**Suggestions implemented:**

- Token masking in list responses, pagination limit (100)
- Stub provider logs truncated tokens
- Validation constants with satisfies guards
- getSystemAccountId returns AccountId (branded) via static import
- Duplicate imports merged, extra blank line removed

**Test coverage added:**

- 8 new dispatcher test cases (customFrontId, pushEnabled-only, both-null, missing system, per-token resilience, multi-friend, no-config default, no-preference default)
- Upsert ownership reassignment + revokedAt clearing tests
- Token masking test, simultaneous update test
- E2E: deterministic 404 (not 500) for non-existent connection
