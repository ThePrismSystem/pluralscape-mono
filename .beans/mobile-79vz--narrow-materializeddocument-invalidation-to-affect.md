---
# mobile-79vz
title: Narrow materialized:document invalidation to affected keys
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: mobile-e3l7
---

Finding [PERF-1] from audit 2026-04-20. apps/mobile/src/data/query-invalidator.ts:22. invalidateQueries({ queryKey: [tableName] }) marks every cached query stale on every sync document event. Cascades in high-frequency scenarios. Fix: narrow invalidation when document type maps 1:1 to entity ID, similar to per-entity path at line 28.
