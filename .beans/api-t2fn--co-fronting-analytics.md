---
# api-t2fn
title: Co-fronting analytics
status: todo
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

- [ ] `AnalyticsService.computeCoFrontingBreakdown(systemId, dateRange)` — returns `CoFrontingAnalytics`
- [ ] Detect overlapping sessions between distinct members
- [ ] Per-pair: total overlap duration, session count, percentage of total
- [ ] Canonical pair ordering (lexicographic by member ID, matching `CoFrontingPair` type)
- [ ] `coFrontingPercentage`: fraction of total fronting time that involved co-fronting
- [ ] Date range filtering (same presets as fronting breakdown)
- [ ] Unit tests with complex overlap scenarios
