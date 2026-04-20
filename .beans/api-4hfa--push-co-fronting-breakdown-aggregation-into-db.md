---
# api-4hfa
title: Push co-fronting breakdown aggregation into DB
status: todo
type: task
priority: high
created_at: 2026-04-20T13:03:18Z
updated_at: 2026-04-20T13:03:21Z
parent: ps-9u4w
---

Follow-up from api-njhu partial fix. computeCoFrontingBreakdown in apps/api/src/services/analytics.service.ts still calls fetchSessionsInRange (.limit(MAX_ANALYTICS_SESSIONS=10000)) and runs sweep-line pair-overlap math in JS at lines 322-368. To push into Postgres, consider: (1) GROUP BY with self-join / LATERAL subquery to compute pairwise overlap durations, OR (2) a window-function approach using tstzrange overlap operators. Requires index decisions on (systemId, startedAt, endedAt). Parent to M15 (ps-9u4w).
