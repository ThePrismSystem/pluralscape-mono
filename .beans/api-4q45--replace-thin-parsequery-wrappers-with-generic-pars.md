---
# api-4q45
title: Replace thin parseQuery wrappers with generic parseQueryOrThrow
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:11Z
parent: api-kjyg
---

parseWebhookConfigQuery and parseWebhookDeliveryQuery in services do nothing beyond safeParse + throw. Replace with a generic parseQueryOrThrow(schema, query) utility.
