---
# api-pj41
title: Add timestamp to webhook HMAC signature for replay protection
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T09:41:30Z
parent: ps-4ioj
---

Webhook signature is HMAC(secret, payload) with no timestamp. Captured deliveries can be replayed indefinitely. Add timestamp to HMAC computation and X-Pluralscape-Timestamp header.

## Summary of Changes

- Added timestamp parameter to computeWebhookSignature in webhook-delivery-worker.ts, HMAC now signs `{timestamp}.{payload}` instead of just payload
- Moved WEBHOOK_SIGNATURE_HEADER from webhook-delivery-worker.ts to service.constants.ts
- Added WEBHOOK_TIMESTAMP_HEADER constant (X-Pluralscape-Timestamp) to service.constants.ts
- Updated processWebhookDelivery to generate Unix-seconds timestamp, pass it to signature computation, and send it as a header
- Updated unit tests with 3-parameter signature calls, added tests for timestamp inclusion in HMAC and signature change on timestamp change
- Updated integration tests to verify timestamp header is sent and signature matches with timestamp
- All imports updated to reference service.constants.ts
