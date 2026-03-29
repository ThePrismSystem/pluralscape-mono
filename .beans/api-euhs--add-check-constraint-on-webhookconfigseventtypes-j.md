---
# api-euhs
title: Add CHECK constraint on webhookConfigs.eventTypes JSONB
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

packages/db/src/schema/pg/webhooks.ts:42 — eventTypes column accepts any JSON at DB level. Direct INSERTs could store invalid event types or empty arrays. Add a CHECK constraint or jsonb_array_length > 0 at minimum.
