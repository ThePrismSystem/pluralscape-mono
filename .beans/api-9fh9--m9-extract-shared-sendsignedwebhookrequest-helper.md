---
# api-9fh9
title: "M9: Extract shared sendSignedWebhookRequest helper"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

Duplicate HTTP delivery logic between testWebhookConfig (webhook-config.service.ts:607-654) and processWebhookDelivery (webhook-delivery-worker.ts:148-181).

## Summary of Changes\n\nExtracted sendSignedWebhookRequest helper to apps/api/src/lib/webhook-fetch.ts. Used by both testWebhookConfig and processWebhookDelivery. Added unit tests.
