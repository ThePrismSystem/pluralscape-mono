---
# api-f6jg
title: Add webhook secret rotation endpoint
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-16T06:29:44Z
parent: ps-4ioj
---

No mechanism to rotate webhook HMAC signing secrets without deleting and recreating the config. Add POST /:webhookId/rotate-secret endpoint.
