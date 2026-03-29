---
# api-kbf3
title: Consider one-time-read pattern for webhook secret responses
status: todo
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T07:13:17Z
parent: api-kjyg
---

webhook-config.service.ts:203,549 returns raw secret in HTTP response body. Cache-Control: no-store is set but if response is logged by a proxy, the secret is exposed. Consider a one-time-read pattern.
