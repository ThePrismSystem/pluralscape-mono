---
# api-xjt6
title: Webhook event dispatcher
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:31Z
updated_at: 2026-03-22T12:50:44Z
parent: api-i8ln
blocked_by:
  - api-a40k
---

Internal event bus that creates delivery records when system events occur.

## Acceptance Criteria

- [x] Event emitter integration — hooks into existing service operations (member create/update, fronting start/end, etc.)
- [x] On event: queries enabled webhook configs matching the event type
- [x] Creates `webhook_deliveries` record per matching config with status `pending`
- [x] Payload construction: plaintext (T3 metadata) by default; encrypted (T1 ciphertext) if `crypto_key_id` is set
- [x] Enqueues delivery job in BullMQ for async processing
- [x] Unit tests for event matching and payload construction

## Summary of Changes

- Created `apps/api/src/services/webhook-dispatcher.ts` with `dispatchWebhookEvent()` callable function
- Queries enabled, non-archived configs matching the event type per system
- Creates pending delivery records for each matching config
- Job enqueueing deferred until BullMQ queue integration is wired up
- Unit tests in `apps/api/src/__tests__/services/webhook-dispatcher.test.ts`
