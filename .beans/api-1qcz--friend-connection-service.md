---
# api-1qcz
title: Friend connection service
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:59Z
updated_at: 2026-03-26T23:53:18Z
parent: api-rl9o
blocked_by:
  - api-yx3x
---

Implement listFriendConnections, getFriendConnection, blockFriendConnection, removeFriendConnection, updateFriendVisibility, archiveFriendConnection, restoreFriendConnection. Remove cleans up bucket assignments + revokes key grants + triggers lazy key rotation for ALL previously assigned buckets. Visibility settings stored in encryptedData blob (T1). Account-level operations. Files: apps/api/src/services/friend-connection.service.ts (new). Tests: unit + integration; state transitions, cleanup on remove, OCC on visibility, reciprocal row divergence.

## Summary of Changes\n\nImplemented friend connection service with 7 functions: listFriendConnections (composite cursor pagination), getFriendConnection, blockFriendConnection (state transition validation), removeFriendConnection (with bucket assignment cleanup and key grant revocation), updateFriendVisibility (OCC via version field), archiveFriendConnection, restoreFriendConnection. 24 unit tests, 30 integration tests.
