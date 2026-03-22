---
# api-t2fn
title: Co-fronting analytics
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:51Z
updated_at: 2026-03-22T12:50:47Z
parent: api-8sel
blocked_by:
  - api-xfh9
---

Overlap detection and pair analysis for co-fronting statistics.

## Acceptance Criteria

- [x] `AnalyticsService.computeCoFrontingBreakdown(systemId, dateRange)` — returns `CoFrontingAnalytics`
- [x] Detect overlapping sessions between distinct members
- [x] Per-pair: total overlap duration, session count, percentage of total
- [x] Canonical pair ordering (lexicographic by member ID, matching `CoFrontingPair` type)
- [x] `coFrontingPercentage`: fraction of total fronting time that involved co-fronting
- [x] Date range filtering (same presets as fronting breakdown)
- [x] Unit tests with complex overlap scenarios

## Summary of Changes

Added `computeCoFrontingBreakdown()` to `analytics.service.ts`. Detects overlapping sessions between distinct members with canonical pair ordering. Computes per-pair overlap duration/count and overall co-fronting percentage. Custom fronts excluded from co-fronting pairs. Unit tests cover: no-overlap, overlap detection, canonical ordering, open sessions, custom front exclusion.
