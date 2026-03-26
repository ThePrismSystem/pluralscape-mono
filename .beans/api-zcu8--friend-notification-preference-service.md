---
# api-zcu8
title: Friend notification preference service
status: todo
type: feature
created_at: 2026-03-26T16:04:49Z
updated_at: 2026-03-26T16:04:49Z
parent: api-nie2
blocked_by:
  - api-1qcz
---

Implement getOrCreateFriendNotificationPreference, updateFriendNotificationPreference, listFriendNotificationPreferences. Account-level per ADR 021, composite FK to friendConnections(id, accountId). Files: apps/api/src/services/friend-notification-preference.service.ts (new). Tests: unit + integration; creation for accepted friends, rejection for non-existent connections.
