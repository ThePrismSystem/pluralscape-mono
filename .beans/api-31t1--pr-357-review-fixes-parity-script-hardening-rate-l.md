---
# api-31t1
title: "PR #357 review fixes: parity script hardening, rate-limit improvements, test cleanup"
status: completed
type: task
priority: normal
created_at: 2026-04-02T21:51:31Z
updated_at: 2026-04-02T23:02:37Z
---

Fix all critical, important, and suggested issues from PR #357 code review. See docs/superpowers/plans/2026-04-02-pr357-review-fixes.md for full plan.

## Summary of Changes

- Extracted parity script into testable library (`trpc-parity-lib.ts`) + thin entry point
- Added `ParityDimension` string literal union type, removed unused regex constants
- Fixed `walkRouteTree` to record failures instead of silently returning `[]`
- Made `extractBalancedBlock` aware of strings, template literals, and comments
- Promoted missing tRPC rate-limit detection from warning to failure
- Added 26 unit tests + 1 integration smoke test for parity script
- Added IP fallback warning to tRPC rate limiter (matches REST-side behavior)
- Added 5 edge-case tests for rate-limit middleware (categories, custom extractors)
- Removed backwards-compatible `SYSTEM_ID` alias, added `getRateLimitKey` and `assertProcedureRateLimited` helpers
- Bulk renamed `SYSTEM_ID` to `MOCK_SYSTEM_ID` across 31 router test files
- Added mutation rate-limit tests to 28 router test files
- Documented bucket export `readHeavy` rate-limit rationale
- Fixed E2E fronting test (null → undefined for optional branded IDs)
