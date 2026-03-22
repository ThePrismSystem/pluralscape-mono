---
# api-a40k
title: Webhook config CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:24Z
updated_at: 2026-03-22T12:50:57Z
parent: api-i8ln
---

Service, routes, and tests for webhook configuration management.

## Acceptance Criteria

- [ ] `WebhookConfigService` with create/list/get/update/archive/restore/delete
- [ ] `url` validation (valid URL format, HTTPS required in production)
- [ ] `secret` generation on create: random HMAC signing key, stored as T3 binary. Secret is returned in the create response only — never exposed again via GET endpoints (like GitHub webhook secrets)
- [ ] `event_types` JSONB validation against `WebhookEventType` enum
- [ ] `crypto_key_id` optional FK to `api_keys` — validates key exists if provided
- [ ] `enabled` toggle
- [ ] Delete returns 409 HAS_DEPENDENTS if pending deliveries exist
- [ ] Routes at `/systems/:systemId/webhook-configs`
- [ ] Route-level tests
- [ ] OpenAPI spec: `schemas/webhooks.yaml` + `paths/webhook-configs.yaml`
