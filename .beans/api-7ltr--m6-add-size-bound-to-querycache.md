---
# api-7ltr
title: 'M6: Add size bound to QueryCache'
status: todo
type: task
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T09:52:48Z
parent: api-hvub
---

lib/query-cache.ts:14-57 — Grows unboundedly; entries never re-accessed remain in memory forever. Slow memory leak with many systems.
