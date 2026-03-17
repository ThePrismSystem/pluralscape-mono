---
# api-0hm2
title: Decide on safeJson() adoption or removal
status: todo
type: task
priority: low
created_at: 2026-03-17T04:00:45Z
updated_at: 2026-03-17T04:00:45Z
parent: api-o89k
---

lib/typed-routes.ts defines safeJson() with ServerSafe<T> branding but no routes use it. Either adopt it across all routes for type-safe responses or remove the dead code.
