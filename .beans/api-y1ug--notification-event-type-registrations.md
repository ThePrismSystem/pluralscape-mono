---
# api-y1ug
title: Notification event type registrations
status: todo
type: feature
created_at: 2026-03-26T16:04:32Z
updated_at: 2026-03-26T16:04:32Z
parent: api-nie2
---

Add audit event types: device-token.registered/revoked, notification-config.updated, friend-notification-preference.updated. Refine notification-send job payload in packages/types/src/jobs.ts from Record<string, unknown> to typed payload. Files: packages/types/src/audit-log.ts, jobs.ts, packages/db/src/helpers/enums.ts.
