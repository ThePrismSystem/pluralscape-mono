---
# api-jjnl
title: Scope enforcement PR review remediation
status: completed
type: task
priority: normal
created_at: 2026-04-06T21:03:11Z
updated_at: 2026-04-06T21:43:23Z
---

Fix critical/important issues and implement suggestions from PR review of scope enforcement

## Checklist

- [x] Task 1: Refactor hasScope() — tier-level lookup, audit-log guard, typed splitScope
- [x] Task 2: Split UNAUTHORIZED/FORBIDDEN in tRPC scope middleware
- [x] Task 3: Add Hono scope middleware unit tests
- [x] Task 4: Add tRPC scope middleware unit tests
- [x] Task 5: Add scope enforcement integration test
- [x] Task 6: Extract findNearestMiddleware in parity script
- [x] Task 7: Final verification

## Summary of Changes

- Refactored `hasScope()` to use numeric `TIER_LEVEL` map, eliminating duplicated if/else chains
- Added explicit `audit-log` domain guard to avoid phantom `write:audit-log`/`delete:audit-log` casts
- Typed `splitScope()` return as `[ScopeTier, string]` with runtime guard
- Split UNAUTHORIZED (missing auth) from FORBIDDEN (insufficient scope) in tRPC middleware
- Added 6 Hono middleware unit tests, 6 tRPC middleware unit tests, 8 integration tests
- Extracted `findNearestMiddleware` generic function in parity script (-40 lines)
