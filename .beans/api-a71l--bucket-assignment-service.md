---
# api-a71l
title: Bucket assignment service
status: todo
type: feature
created_at: 2026-03-26T16:03:59Z
updated_at: 2026-03-26T16:03:59Z
parent: api-rl9o
blocked_by:
  - api-e3hk
---

Implement assignBucketToFriend, unassignBucketFromFriend, listFriendBucketAssignments. Bridges system-owned buckets with account-level connections. Validates: bucket exists + unarchived, connection accepted, no duplicate. On assign: create key grant (encrypt bucket key with friend X25519 public key). On unassign: revoke key grants, trigger lazy key rotation (ADR 014). Explicitly document old key holders retain access until rotation completes. Files: apps/api/src/services/bucket-assignment.service.ts (new). Tests: unit + integration; non-existent bucket, non-accepted connection, duplicate, key grant creation, unassign-during-rotation.
