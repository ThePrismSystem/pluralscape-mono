---
# db-l9yc
title: "Fix PR review issues: DB schema batch 6"
status: completed
type: task
priority: normal
created_at: 2026-03-10T08:57:03Z
updated_at: 2026-03-10T09:03:45Z
---

Fix 4 important issues and 8 suggestions from PR review: column renames, bigint, self-ref FK, createdAt, token widening, annotations, DDL helpers, and missing tests

## Summary of Changes

### Schema (6 files)

- **blob-metadata**: contentType -> mimeType, thumbnailBlobId -> thumbnailOfBlobId, sizeBytes integer -> bigint (PG), added self-referential FK on thumbnailOfBlobId
- **webhooks**: events -> eventTypes with $type<readonly WebhookEventType[]>(), added createdAt to webhookDeliveries
- **notifications**: added $type<readonly FriendNotificationEventType[]>() to enabledEventTypes, widened token varchar(255) -> varchar(512)

### DDL helpers (2 files)

- Mirrored all column renames, bigint, FK, and createdAt additions

### Tests (8 files)

- Updated all references for renames
- Added 7 FK cascade tests (device_tokens account, friend_notification_preferences friend_connection, webhook_deliveries system, blob_metadata bucket SET NULL, webhook_configs crypto_key SET NULL)
- Added 2 PG CHECK constraint tests (notification_configs event_type, webhook_deliveries status)
- Added 4 boolean false round-trip tests (notification_configs, webhook_configs, timer_configs, check_in_records)

### Follow-up

- Created bean db-lrk6 for index.ts type alias deduplication
