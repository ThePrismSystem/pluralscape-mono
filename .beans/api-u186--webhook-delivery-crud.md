---
# api-u186
title: Webhook delivery CRUD
status: completed
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

- [x] `WebhookDeliveryService` with list/get/delete
- [x] List endpoint: cursor pagination, `webhookId` filter, `status` filter, `eventType` filter
- [x] No create/update routes (deliveries are created internally by the dispatcher)
- [x] Delete individual delivery records
- [x] Routes at `/systems/:systemId/webhook-deliveries`
- [x] Route-level tests
- [x] OpenAPI spec: `paths/webhook-deliveries.yaml`

## Summary of Changes

- Created `apps/api/src/services/webhook-delivery.service.ts` with list, get, delete
- Created route files under `apps/api/src/routes/webhook-deliveries/` (list, get, delete, index)
- Added `WebhookDeliveryQuerySchema` to validation package
- Created OpenAPI spec for webhook delivery endpoints
- Route-level tests in `apps/api/src/__tests__/routes/webhook-deliveries/`
