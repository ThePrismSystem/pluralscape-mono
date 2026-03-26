---
# api-ikfb
title: Friend access authorization module
status: todo
type: feature
created_at: 2026-03-26T16:05:10Z
updated_at: 2026-03-26T16:05:10Z
parent: client-napj
blocked_by:
  - api-nsi8
---

Implement assertFriendAccess(db, auth, friendConnectionId) -> returns { connection, assignedBucketIds, visibility } or throws 404. Validates: connection exists, status accepted, not archived, auth.accountId === friendConnections.friendAccountId. Return 404 (not 403) for invalid connections to avoid leaking existence. Uses service-role DB context (RLS-bypassed) with application-level gating. Files: apps/api/src/lib/friend-access.ts (new), friend-access.constants.ts (new). Tests: unit + integration; all connection states, bucket resolution, direction validation.
