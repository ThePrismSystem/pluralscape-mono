---
# api-a71l
title: Bucket assignment service
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:59Z
updated_at: 2026-03-27T00:12:05Z
parent: api-rl9o
blocked_by:
  - api-e3hk
---

Implement assignBucketToFriend, unassignBucketFromFriend, listFriendBucketAssignments. Bridges system-owned buckets with account-level connections. Validates: bucket exists + unarchived, connection accepted, no duplicate. On assign: create key grant (encrypt bucket key with friend X25519 public key). On unassign: revoke key grants, trigger lazy key rotation (ADR 014). Explicitly document old key holders retain access until rotation completes. Files: apps/api/src/services/bucket-assignment.service.ts (new). Tests: unit + integration; non-existent bucket, non-accepted connection, duplicate, key grant creation, unassign-during-rotation.

## Summary of Changes\n\nImplemented bucket assignment service with 3 functions: assignBucketToFriend (idempotent insert + key grant creation, validates bucket exists/unarchived and connection accepted), unassignBucketFromFriend (deletes assignment, revokes key grants), listFriendBucketAssignments (inner join to get friendAccountId). System-level operations using withTenantTransaction. 11 unit tests, 9 integration tests.
