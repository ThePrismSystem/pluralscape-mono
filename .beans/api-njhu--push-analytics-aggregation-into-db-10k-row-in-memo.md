---
# api-njhu
title: Push analytics aggregation into DB (10K row in-memory sweep)
status: completed
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T12:37:16Z
parent: api-v8zu
---

Finding [P1] from audit 2026-04-20. apps/api/src/services/analytics.service.ts:119-134. MAX_ANALYTICS_SESSIONS=10_000 rows fetched and processed in-process; all-time preset fetches without date filtering. Fix: GROUP BY / window functions in DB.

## Summary of Changes

Partial fix — single-subject breakdown only.

- **computeFrontingBreakdown (single-subject)**: aggregation pushed into Postgres via Drizzle-generated GROUP BY + SUM(clamped_duration). No in-memory rows loaded; SQL uses to_timestamp + GREATEST/LEAST for date-range clamping and EXTRACT(EPOCH ...) \* 1000 for millisecond duration. This is the primary hot path for analytics dashboards.
- **computeCoFrontingBreakdown (pairwise overlap)**: unchanged. Still loads up to MAX_ANALYTICS_SESSIONS=10000 rows via fetchSessionsInRange and runs sweep-line pair-overlap math in JS. Smaller workload than single-subject but retains the original behavior. Tracked as follow-up in **api-4hfa** (parented to M15 ps-9u4w).
- Updated unit tests to mock aggregated rows directly for the single-subject path (math is in SQL now); integration tests exercise the real SQL. Co-fronting tests unchanged.
