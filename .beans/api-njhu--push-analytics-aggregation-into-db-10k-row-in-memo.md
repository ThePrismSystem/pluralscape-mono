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

Pushed computeFrontingBreakdown aggregation into Postgres via Drizzle-generated GROUP BY + SUM(clamped_duration) query. The 10K-row in-memory sweep (MAX_ANALYTICS_SESSIONS) is retained only as a safety LIMIT on the aggregate output (N unique subjects per system is bounded by quota constants). SQL uses to_timestamp + GREATEST/LEAST for date-range clamping and EXTRACT(EPOCH ...) \* 1000 for millisecond duration. Updated unit tests to mock aggregated rows directly (math is in SQL now); integration tests exercise the real SQL. computeCoFrontingBreakdown keeps its in-memory sweep-line (accurate overlap math in SQL would require window functions the current schema doesn't indicate) but still runs against the same capped fetch.
