---
# api-pq22
title: Add analytics service integration tests
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:24:09Z
updated_at: 2026-03-24T10:36:26Z
parent: ps-4ioj
---

computeFrontingBreakdown and computeCoFrontingBreakdown have no integration tests. Complex date clamping and SQL filtering needs real DB validation via PGlite.

## Summary of Changes\n\nCreated `apps/api/src/__tests__/services/analytics.service.integration.test.ts` with 14 PGlite integration tests:\n- 8 tests for `computeFrontingBreakdown`: empty results, single session, start/end clamping, out-of-range exclusion, multiple subjects with percentage calculation, archived exclusion, descending sort order\n- 6 tests for `computeCoFrontingBreakdown`: empty results, overlap detection, non-overlapping sessions, customFront exclusion, multiple pairs (3 members), canonical pair ordering
