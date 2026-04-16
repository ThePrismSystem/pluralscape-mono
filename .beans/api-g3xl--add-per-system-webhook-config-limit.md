---
# api-g3xl
title: Add per-system webhook config limit
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-16T06:29:44Z
parent: ps-4ioj
---

No max webhook configs per system. Unbounded creation enables delivery amplification. Add count check in createWebhookConfig (e.g., max 25 per system).
