---
# api-0hm2
title: Decide on safeJson() adoption or removal
status: completed
type: task
priority: low
created_at: 2026-03-17T04:00:45Z
updated_at: 2026-03-17T05:33:29Z
parent: api-o89k
---

lib/typed-routes.ts defines safeJson() with ServerSafe<T> branding but no routes use it. Either adopt it across all routes for type-safe responses or remove the dead code.

## Summary of Changes\n\nDeleted lib/typed-routes.ts (safeJson dead code). Zero callers existed. ServerSafe<T> and serverSafe() in packages/types remain — actively used elsewhere.
