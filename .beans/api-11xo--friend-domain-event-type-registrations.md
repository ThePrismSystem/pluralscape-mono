---
# api-11xo
title: Friend domain event type registrations
status: todo
type: feature
created_at: 2026-03-26T16:03:42Z
updated_at: 2026-03-26T16:03:42Z
parent: api-rl9o
blocked_by:
  - api-rl9o
---

Add audit event types: friend-code.generated/redeemed/archived, friend-connection.created/accepted/blocked/removed/archived/restored, friend-bucket-assignment.assigned/unassigned, friend-visibility.updated. Webhook event types: friend.connected/removed, friend.bucket-assigned/unassigned. Files: packages/types/src/audit-log.ts, webhooks.ts, packages/db/src/helpers/enums.ts.
