---
# api-xfh9
title: Fronting analytics computation service
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:47Z
updated_at: 2026-03-22T12:50:59Z
parent: api-8sel
blocked_by:
  - api-vuhs
---

Core computation logic for per-member fronting statistics.

## Acceptance Criteria

- [x] `AnalyticsService.computeFrontingBreakdown(systemId, dateRange)` — returns `MemberFrontingBreakdown[]`
- [x] Per-member: total duration, session count, average session length, percentage of total
- [x] Date range filtering: preset (`last-7-days`, `last-30-days`, `last-90-days`, `last-year`, `all-time`) or custom (`startDate`/`endDate`)
- [x] Open sessions (end_time IS NULL): cap duration at query time for ongoing sessions
- [x] Handles co-fronting correctly — overlapping sessions each count their full duration (no dedup)
- [x] Custom fronts and structure entities included in breakdown alongside members — response returns a flat array with a `subjectType` discriminator (`member` | `customFront` | `structureEntity`) and polymorphic `subjectId`/`subjectName` fields
- [x] Unit tests with various session configurations (overlapping, open, archived)

## Summary of Changes

Created `apps/api/src/services/analytics.service.ts` with `computeFrontingBreakdown()` function. Added `SubjectFrontingBreakdown` and `FrontingSubjectType` types to `@pluralscape/types`. Added `DateRangeFilter` parsing in `analytics-query.service.ts`. Unit tests cover: single member sessions, open sessions capped at current time, multi-session aggregation, custom fronts, structure entities, percentage calculations.
