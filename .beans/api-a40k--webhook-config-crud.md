---
# api-a40k
title: Webhook config CRUD
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:24Z
updated_at: 2026-03-22T12:50:57Z
parent: api-i8ln
---

Service, routes, and tests for webhook configuration management.

## Acceptance Criteria

- [x] `WebhookConfigService` with create/list/get/update/archive/restore/delete
- [x] `url` validation (valid URL format, HTTPS required in production)
- [x] `secret` generation on create: random HMAC signing key, stored as T3 binary. Secret is returned in the create response only — never exposed again via GET endpoints (like GitHub webhook secrets)
- [x] `event_types` JSONB validation against `WebhookEventType` enum
- [x] `crypto_key_id` optional FK to `api_keys` — validates key exists if provided
- [x] `enabled` toggle
- [x] Delete returns 409 HAS_DEPENDENTS if pending deliveries exist
- [x] Routes at `/systems/:systemId/webhook-configs`
- [x] Route-level tests
- [x] OpenAPI spec: `schemas/webhooks.yaml` + `paths/webhook-configs.yaml`

## Summary of Changes

- Created `apps/api/src/services/webhook-config.service.ts` with full CRUD operations
- Created route files under `apps/api/src/routes/webhook-configs/` (create, list, get, update, delete, archive, restore, index)
- Created validation schemas in `packages/validation/src/webhook.ts`
- Added audit event types for webhook configs to `packages/types/src/audit-log.ts`
- Added `versioned()` column to `webhook_configs` schema for OCC support
- Registered routes in `apps/api/src/routes/systems/index.ts`
- Created OpenAPI specs for webhook config endpoints
- Route-level tests in `apps/api/src/__tests__/routes/webhook-configs/`
