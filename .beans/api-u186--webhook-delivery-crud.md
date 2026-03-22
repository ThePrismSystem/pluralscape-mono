---
# api-u186
title: Webhook delivery CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:27Z
updated_at: 2026-03-22T12:50:43Z
parent: api-i8ln
blocked_by:
  - api-a40k
---

Service, routes, and tests for webhook delivery records (mostly read-only for consumers).

## Acceptance Criteria

- [ ] `WebhookDeliveryService` with list/get/delete
- [ ] List endpoint: cursor pagination, `webhookId` filter, `status` filter, `eventType` filter
- [ ] No create/update routes (deliveries are created internally by the dispatcher)
- [ ] Delete individual delivery records
- [ ] Routes at `/systems/:systemId/webhook-deliveries`
- [ ] Route-level tests
- [ ] OpenAPI spec: `paths/webhook-deliveries.yaml`
