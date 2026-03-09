---
# types-qryr
title: Privacy bucket types
status: completed
type: task
priority: high
created_at: 2026-03-08T13:32:16Z
updated_at: 2026-03-09T00:50:34Z
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

- [x] PrivacyBucket with timestamps
- [x] BucketContentTag maps any entity to buckets
- [x] BucketVisibilityScope 9-member union
- [x] KeyGrant with revokedAt for key rotation (no AuditMetadata)
- [x] FriendConnection with AuditMetadata, FriendConnectionStatus 4-member union
- [x] FriendCode immutable type (no AuditMetadata)
- [x] Fail-closed default documented in type JSDoc
- [x] BucketAccessCheck parameter type with intersection logic JSDoc
- [x] Unit tests for all privacy types

## References

- ADR 006 (Privacy Bucket Model)
- features.md section 4 (Privacy and Social)

## Summary of Changes

Implemented in `packages/types/src/privacy.ts`:

- `PrivacyBucket` with AuditMetadata
- `BucketContentTag` junction type
- `BucketVisibilityScope` 9-member union
- `KeyGrant` immutable grant (no AuditMetadata, Uint8Array for encrypted key)
- `FriendConnectionStatus` 4-member union
- `FriendConnection` with AuditMetadata and assignedBucketIds
- `FriendCode` immutable (no AuditMetadata)
- `BucketAccessCheck` parameter type with fail-closed JSDoc
- Full test coverage in `privacy.test.ts`
