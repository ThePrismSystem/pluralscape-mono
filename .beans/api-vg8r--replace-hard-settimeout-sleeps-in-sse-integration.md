---
# api-vg8r
title: Replace hard setTimeout sleeps in SSE integration test
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [TQ-01] from audit 2026-04-20. apps/api/src/**tests**/routes/notifications/stream.integration.test.ts lines 121,175,219,226,253,300,378,380,400. 9 hard setTimeout sleeps (50-150ms). Real flakiness source under CI load. Fix: deadline-loop poll instead of fixed sleeps.
