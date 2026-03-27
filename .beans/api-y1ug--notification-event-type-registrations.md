---
# api-y1ug
title: Notification event type registrations
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:32Z
updated_at: 2026-03-27T07:14:52Z
parent: api-nie2
---

Add audit event types: device-token.registered/revoked, notification-config.updated, friend-notification-preference.updated. Refine notification-send job payload in packages/types/src/jobs.ts from Record<string, unknown> to typed payload. Files: packages/types/src/audit-log.ts, jobs.ts, packages/db/src/helpers/enums.ts.

## Summary of Changes

Added 4 audit event types (device-token.registered, device-token.revoked, notification-config.updated, friend-notification-preference.updated) to AuditEventType union and AUDIT_EVENT_TYPES array. Typed the notification-send job payload in JobPayloadMap with systemId, deviceTokenId, platform, and payload fields.
