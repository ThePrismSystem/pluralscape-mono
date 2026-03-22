---
# sync-pgmk
title: CRDT sync for webhooks
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:38Z
updated_at: 2026-03-22T12:51:03Z
parent: api-i8ln
blocked_by:
  - api-a40k
---

Register CRDT strategy for webhook configs. Deliveries are server-only (not synced).

## Acceptance Criteria

- [x] Webhook config strategy: LWW-Map in `system-core` document
- [x] Deliveries are NOT synced (server-authoritative, created by dispatcher)
- [x] Post-merge validation: webhook config validates URL format (HTTPS in production), `event_types` against `WebhookEventType` enum
- [x] Tests for merge conflict scenarios

## Summary of Changes

- Added `"webhook-config"` CRDT strategy to `packages/sync/src/strategies/crdt-strategies.ts` (lww-map, system-core document)
- Added `normalizeWebhookConfigs()` to `packages/sync/src/post-merge-validator.ts` for URL format and event type validation
- Integrated into `runAllValidations()` with `webhookConfigIssues` counter
- Added `webhookConfigIssues` field to `PostMergeValidationResult` type
- Updated existing sync test mocks for the new result field
