---
# api-uo21
title: Cache notificationConfigs in switch-alert-dispatcher
status: todo
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [P5] from audit 2026-04-20. apps/api/src/services/switch-alert-dispatcher.ts:53-65. Fire-and-forget on every fronting session create with no caching (unlike webhook configs which use QueryCache). Most frequent path. Add in-request or short-TTL cache.
