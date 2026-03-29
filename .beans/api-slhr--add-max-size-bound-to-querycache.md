---
# api-slhr
title: Add max-size bound to QueryCache
status: todo
type: bug
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

apps/api/src/lib/query-cache.ts:14-57 grows unboundedly. Lazy TTL eviction removes stale entries on access but entries never re-accessed remain forever. Add LRU max-size eviction or periodic sweep.
