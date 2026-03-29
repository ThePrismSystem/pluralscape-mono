---
# api-e38t
title: "L7: Create generic parseQueryOrThrow helper"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

parseWebhookConfigQuery / parseWebhookDeliveryQuery are thin wrappers that could use a generic parseQueryOrThrow.

## Summary of Changes\n\nWired existing parseQuery helper into webhook config and delivery services, replacing inline safeParse logic.
