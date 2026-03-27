---
# api-cek7
title: Push notification worker
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:56Z
updated_at: 2026-03-27T07:50:07Z
parent: api-nie2
blocked_by:
  - api-pdwk
---

Background job worker that delivers via APNs/FCM. Initial implementation: stub providers that log (pre-production). Real provider integration deferred to M8. Follow webhook-delivery-worker.ts pattern (retry, backoff, failure handling). Files: apps/api/src/services/push-notification-worker.ts (new), apps/api/src/lib/push-providers/ (apns.ts, fcm.ts, types.ts). Tests: unit with mock providers, integration with stub endpoints.

## Summary of Changes

Implemented push-notification-worker.ts with PushProvider interface, StubPushProvider (M6 stub that logs), and processPushNotification job processor. Loads device token, skips revoked/missing tokens, calls provider.send, updates lastActiveAt on success. Provider errors propagate for queue retry. Integration tests cover all paths.
