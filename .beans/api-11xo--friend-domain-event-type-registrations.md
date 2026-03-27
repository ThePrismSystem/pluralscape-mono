---
# api-11xo
title: Friend domain event type registrations
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:42Z
updated_at: 2026-03-26T23:24:52Z
parent: api-rl9o
---

Add audit event types: friend-code.generated/redeemed/archived, friend-connection.created/accepted/blocked/removed/archived/restored, friend-bucket-assignment.assigned/unassigned, friend-visibility.updated. Webhook event types: friend.connected/removed, friend.bucket-assigned/unassigned. Files: packages/types/src/audit-log.ts, webhooks.ts, packages/db/src/helpers/enums.ts.

## Summary of Changes\n\nRegistered 11 audit event types (friend-code.generated/redeemed/archived, friend-connection.created/blocked/removed/archived/restored, friend-visibility.updated, friend-bucket-assignment.assigned/unassigned) and 4 webhook event types (friend.connected/removed, friend.bucket-assigned/unassigned) with payload interfaces and map entries. Updated mirror arrays in db/helpers/enums.ts and validation/validation.constants.ts. Updated exhaustive switch contract tests.
