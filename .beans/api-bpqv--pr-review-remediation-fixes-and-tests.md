---
# api-bpqv
title: PR review remediation — fixes and tests
status: completed
type: task
priority: normal
created_at: 2026-04-03T08:25:34Z
updated_at: 2026-04-03T08:43:27Z
---

Fix 2 important issues, implement 2 suggestions, add 8 missing tests from PR #369 review

## Summary of Changes

### Code Fixes (4)

- Fixed contradictory comment in system middleware — documented that optional chaining is defensive since middleware type doesn't carry protectedProcedure's narrowing
- Gated E2E loggerLink behind `DEBUG_TRPC` env var
- Simplified `createTRPCContextInner` parameter to use `TRPCContext` interface directly
- Extracted `MAX_URL_LENGTH`/`MAX_BATCH_ITEMS` to api-client, imported in mobile (E2E kept local — no api-client dep)

### Tests Added (8)

- errorFormatter: zodError tree present on validation failures, null for non-Zod errors
- isDev: stack traces suppressed when NODE_ENV != development
- 422 UNPROCESSABLE_CONTENT error mapping
- Null cursor handling (.nullish() validation)
- Cache-control no-store E2E header check
- createMemoizedTokenGetter: concurrent dedup, fresh-after-resolve, rejection-clearing, rejection-broadcast
- isTRPCClientError type guard
- loggerLink gating (implicit via E2E)
