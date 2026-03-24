---
# types-21iy
title: Fix WebhookDelivery type/DB schema divergence
status: completed
type: bug
priority: critical
created_at: 2026-03-24T09:21:12Z
updated_at: 2026-03-24T09:27:14Z
parent: ps-4ioj
---

WebhookDelivery type in packages/types/src/webhooks.ts diverges from DB schema and service result type. Fields have different names (statusCode vs httpStatus), missing fields (attemptCount, lastAttemptAt, nextRetryAt), and stale WebhookDeliveryPayload union type.

## Summary of Changes\n\nRewrote WebhookDelivery interface to match DB schema (status, httpStatus, attemptCount, lastAttemptAt, nextRetryAt, createdAt, archivedAt). Removed stale PlaintextWebhookPayload, EncryptedWebhookPayload, WebhookDeliveryPayload types. Updated barrel exports and all tests.
