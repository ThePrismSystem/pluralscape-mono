---
# api-xfh9
title: Fronting analytics computation service
status: todo
type: task
created_at: 2026-03-22T11:49:47Z
updated_at: 2026-03-22T11:49:47Z
parent: api-8sel
---

Core computation logic for per-member fronting statistics.

## Acceptance Criteria

- [ ] `AnalyticsService.computeFrontingBreakdown(systemId, dateRange)` — returns `MemberFrontingBreakdown[]`
- [ ] Per-member: total duration, session count, average session length, percentage of total
- [ ] Date range filtering: preset (`last-7-days`, `last-30-days`, `last-90-days`, `last-year`, `all-time`) or custom (`startDate`/`endDate`)
- [ ] Open sessions (end_time IS NULL): cap duration at query time for ongoing sessions
- [ ] Handles co-fronting correctly — overlapping sessions each count their full duration (no dedup)
- [ ] Custom fronts and structure entities included in breakdown alongside members
- [ ] Unit tests with various session configurations (overlapping, open, archived)
