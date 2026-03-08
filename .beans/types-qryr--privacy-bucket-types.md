---
# types-qryr
title: Privacy bucket types
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:16Z
updated_at: 2026-03-08T13:36:09Z
parent: types-im7i
blocked_by:
  - types-av6x
---

PrivacyBucket, BucketContentTag, KeyGrant, FriendConnection, fail-closed access control

Privacy bucket and access control types. Core to the encryption model.

## Scope

- `PrivacyBucket`: id (BucketId — opaque UUID), systemId, name, description
- `BucketContentTag`: entityType (EntityType), entityId, bucketId — maps content to buckets
- `BucketVisibilityScope`: 'members' | 'custom-fields' | 'fronting-status' | 'custom-fronts' | 'notes' | 'chat' — what a bucket controls visibility of
- `KeyGrant`: id, bucketId, friendUserId, encryptedBucketKey (Uint8Array), keyVersion (number)
- `FriendConnection`: id, systemId, friendSystemId, status ('pending' | 'accepted' | 'blocked'), assignedBucketIds, createdAt
- `BucketAccessCheck`: utility type for checking if content is visible to a friend (intersection logic)
- Fail-closed semantics: content without bucket tags is invisible to ALL friends (maximum restriction)

## Acceptance Criteria

- [ ] PrivacyBucket type with opaque UUID id
- [ ] BucketContentTag maps any entity to buckets
- [ ] KeyGrant includes versioned encrypted key blob
- [ ] FriendConnection tracks friendship status and bucket assignments
- [ ] Fail-closed default documented in type JSDoc
- [ ] Intersection logic type utilities
- [ ] Unit tests for access check logic

## References

- ADR 006 (Privacy Bucket Model)
- features.md section 4 (Privacy and Social)
- encryption-research.md section 4.4
