---
# api-flvl
title: Webhook delivery worker
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:37Z
updated_at: 2026-03-22T12:50:45Z
parent: api-i8ln
blocked_by:
  - api-xjt6
---

BullMQ job that processes pending webhook deliveries.

## Acceptance Criteria

- [x] BullMQ worker processes pending delivery records
- [x] HTTP POST to webhook URL with JSON payload + HMAC signature header (`X-Pluralscape-Signature`)
- [x] HMAC computed from webhook config's `secret` over the payload body
- [x] Success (2xx): set status=`success`, `http_status`, `last_attempt_at`
- [x] Failure (non-2xx or network error): increment `attempt_count`, set `next_retry_at` with exponential backoff
- [x] Max retry attempts (configurable, default 5): set status=`failed` after exhaustion
- [x] Terminal delivery cleanup job: purge `success`/`failed` records older than 30 days
- [x] Integration tests with mock HTTP server

## Summary of Changes

- Created `apps/api/src/services/webhook-delivery-worker.ts` with `processWebhookDelivery()`
- HMAC-SHA256 signature computation using webhook config's secret
- Exponential backoff: 2^attempt \* 1s (1s, 2s, 4s, 8s, 16s)
- Max 5 retry attempts before marking as failed
- Accepts injectable `fetch` function for testing
- Unit tests for signature computation and backoff calculation in `apps/api/src/__tests__/services/webhook-delivery-worker.test.ts`
