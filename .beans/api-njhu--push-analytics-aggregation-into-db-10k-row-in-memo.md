---
# api-njhu
title: Push analytics aggregation into DB (10K row in-memory sweep)
status: todo
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [P1] from audit 2026-04-20. apps/api/src/services/analytics.service.ts:119-134. MAX_ANALYTICS_SESSIONS=10_000 rows fetched and processed in-process; all-time preset fetches without date filtering. Fix: GROUP BY / window functions in DB.
