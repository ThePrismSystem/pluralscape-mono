---
# api-6huz
title: Use branded IDs consistently in structure-entity and webhook services
status: todo
type: task
priority: normal
created_at: 2026-04-14T09:29:40Z
updated_at: 2026-04-14T09:29:40Z
---

AUDIT [API-T-M3,P01,P02] structure-entity-type/crud services accept entityTypeId/entityId as string instead of branded types. webhook-delivery-worker uses raw string literals instead of WebhookDeliveryStatus union. webhook-dispatcher uses string[] instead of WebhookDeliveryId[].
