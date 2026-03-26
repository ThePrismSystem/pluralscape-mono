---
# api-83t8
title: Bucket domain event type registrations
status: todo
type: feature
created_at: 2026-03-26T16:03:05Z
updated_at: 2026-03-26T16:03:05Z
parent: api-e3hk
blocked_by:
  - api-e3hk
---

Add audit event types (bucket.created/updated/archived/restored/deleted, bucket-content-tag.tagged/untagged, field-bucket-visibility.set/removed) and webhook event types + payload interfaces for bucket events. Files: packages/types/src/audit-log.ts, packages/types/src/webhooks.ts, packages/db/src/helpers/enums.ts. Tests: exhaustive switch tests on new union members.
