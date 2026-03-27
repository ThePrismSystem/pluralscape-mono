---
# api-zcu8
title: Friend notification preference service
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:49Z
updated_at: 2026-03-27T07:30:42Z
parent: api-nie2
blocked_by:
  - api-1qcz
---

Implement getOrCreateFriendNotificationPreference, updateFriendNotificationPreference, listFriendNotificationPreferences. Account-level per ADR 021, composite FK to friendConnections(id, accountId). Files: apps/api/src/services/friend-notification-preference.service.ts (new). Tests: unit + integration; creation for accepted friends, rejection for non-existent connections.

## Summary of Changes

Implemented friend-notification-preference.service.ts with getOrCreate (defaults to ['friend-switch-alert']), update (replaces enabledEventTypes array), and list (non-archived, scoped to account). Uses composite FK to friendConnections(id, accountId). Integration tests with PGlite.
