---
# sync-192t
title: Optimise diffEntities to single-pass hash
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [PERF-01] from audit 2026-04-20. packages/sync/src/materializer/base-materializer.ts:49. rowHash() called once for currentMap and again per incoming row. Every update triggers O(n) JSON.stringify twice. Build hash map for incoming rows and compare maps directly.
