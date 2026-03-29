---
# api-opf4
title: Add route tests for webhook-delivery get and delete
status: completed
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

No route-layer tests for GET /webhook-deliveries/:deliveryId or DELETE /webhook-deliveries/:deliveryId. The parseIdParam call with ID_PREFIXES.webhookDelivery is untested at the route layer.
