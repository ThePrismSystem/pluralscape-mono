---
# types-pjvm
title: Fix all PR review issues for infrastructure types
status: completed
type: task
priority: normal
created_at: 2026-03-09T07:40:55Z
updated_at: 2026-03-09T07:45:43Z
---

Address all critical, important, and suggestion-level issues from PR review of feat/types-infrastructure branch

## Summary of Changes

### Source files (8 modules + barrel + encryption tier map)

**ids.ts**: Added 3 branded IDs (JobId, SubscriptionId, WebhookDeliveryId), 3 ID prefixes, 3 EntityType members

**jobs.ts**: Removed local JobId (now from ids.ts), added systemId to JobDefinition, added maxBackoffMs to RetryPolicy

**webhooks.ts**: Removed local WebhookDeliveryId (now from ids.ts), changed WebhookConfig.secret to EncryptedString, added systemId to WebhookDelivery

**realtime.ts**: Removed local SubscriptionId (now from ids.ts), replaced 6 identical interfaces with BaseWebSocketEvent generic + type aliases, changed SSEEvent.event from string to WebSocketEventType

**audit-log.ts**: Replaced actorId: string with discriminated actor union (account | api-key | system), renamed timestamp to createdAt

**notifications.ts**: Changed DeviceToken.token to EncryptedString, added systemId to NotificationPayload

**blob.ts**: Added JSDoc explaining intentional AuditMetadata omission

**api-keys.ts**: Added 7 infrastructure scopes (webhooks, audit-log, blobs, notifications)

**encryption.ts**: Added tier annotations for all infrastructure types

**index.ts**: Moved JobId, SubscriptionId, WebhookDeliveryId to ids.js re-export block

### Test files (10 files updated)

All tests updated to match new source types. Added exhaustive switch tests for JobStatus, WebSocketConnectionState, BlobPurpose, DeviceToken.platform. Added discriminated actor union test. Added search generic constraint tests. Added barrel assertions for all new/moved exports.
