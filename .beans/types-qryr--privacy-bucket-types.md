---
# types-qryr
title: Privacy bucket types
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:16Z
updated_at: 2026-03-08T14:21:31Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Privacy bucket and access control types. Core to the encryption model.

## Scope

- `PrivacyBucket`: id (BucketId), systemId, name, description, createdAt, updatedAt
- `BucketContentTag`: entityType (EntityType), entityId, bucketId — maps content to buckets
- `BucketVisibilityScope`: 'members' | 'custom-fields' | 'fronting-status' | 'custom-fronts' | 'notes' | 'chat' | 'journal-entries' | 'member-photos' | 'groups'
- `KeyGrant`: id (KeyGrantId), bucketId, friendUserId, encryptedBucketKey (Uint8Array), keyVersion (number), createdAt, revokedAt (UnixMillis | null)
- `FriendConnection`: id (FriendConnectionId), systemId, friendSystemId, status ('pending' | 'accepted' | 'blocked' | 'removed'), friendCode (string | null), displayName (string | null), assignedBucketIds (BucketId[]), createdAt, updatedAt
- `FriendCode`: id, systemId, code (string), createdAt, expiresAt (UnixMillis | null)
- `BucketAccessCheck`: utility type for checking if content is visible to a friend (intersection logic)
- Fail-closed semantics: content without bucket tags is invisible to ALL friends

## Acceptance Criteria

- [ ] PrivacyBucket with timestamps
- [ ] BucketContentTag maps any entity to buckets
- [ ] BucketVisibilityScope includes journal-entries, member-photos, groups
- [ ] KeyGrant with revokedAt for key rotation
- [ ] FriendConnection with 'removed' status, friendCode, displayName, updatedAt
- [ ] FriendCode type for friend code exchange
- [ ] Fail-closed default documented in type JSDoc
- [ ] Intersection logic type utilities
- [ ] Unit tests for access check logic

## References

- ADR 006 (Privacy Bucket Model)
- features.md section 4 (Privacy and Social)
