---
# api-7ltr
title: "M6: Add size bound to QueryCache"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

lib/query-cache.ts:14-57 — Grows unboundedly; entries never re-accessed remain in memory forever. Slow memory leak with many systems.

## Summary of Changes\n\nAdded maxSize constructor param (default 10,000) with lazy expired eviction + oldest-entry eviction on capacity.
