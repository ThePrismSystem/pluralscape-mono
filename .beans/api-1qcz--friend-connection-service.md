---
# api-1qcz
title: Friend connection service
status: todo
type: feature
created_at: 2026-03-26T16:03:59Z
updated_at: 2026-03-26T16:03:59Z
parent: api-rl9o
blocked_by:
  - api-yx3x
---

Implement listFriendConnections, getFriendConnection, blockFriendConnection, removeFriendConnection, updateFriendVisibility, archiveFriendConnection, restoreFriendConnection. Remove cleans up bucket assignments + revokes key grants + triggers lazy key rotation for ALL previously assigned buckets. Visibility settings stored in encryptedData blob (T1). Account-level operations. Files: apps/api/src/services/friend-connection.service.ts (new). Tests: unit + integration; state transitions, cleanup on remove, OCC on visibility, reciprocal row divergence.
