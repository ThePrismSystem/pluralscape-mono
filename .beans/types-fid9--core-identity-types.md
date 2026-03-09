---
# types-fid9
title: Core identity types
status: completed
type: task
priority: high
created_at: 2026-03-08T13:32:06Z
updated_at: 2026-03-09T00:15:02Z
parent: types-im7i
blocking:
  - types-itej
  - types-c2eu
  - types-rwnq
  - types-296i
  - types-8klm
  - types-0jjx
  - types-iz5j
blocked_by:
  - types-av6x
---

Core identity types for System and Member entities.

## Scope

- `System`: id (SystemId), name, description, avatarRef (BlobId | null), displayName, settingsId (SystemSettingsId — reference to SystemSettings), createdAt, updatedAt
- `Member`: id (MemberId), systemId, name, pronouns (string[]), description (rich text string with linking support), avatarRef (BlobId | null), colors (string[] — multiple hex colors), completenessLevel (CompletenessLevel), roleTags (RoleTag[]), createdAt, updatedAt
- `CompletenessLevel`: 'fragment' | 'demi-member' | 'full' — nullable fields vary by level
- `RoleTag`: discriminated union: `{ tag: KnownRoleTag } | { tag: 'custom', value: string }`
  - `KnownRoleTag`: 'protector' | 'gatekeeper' | 'caretaker' | 'little' | 'age-slider' | 'trauma-holder' | 'host' | 'persecutor' | 'mediator'
- `MemberPhoto`: id, memberId, url/ref (BlobId), sortOrder, caption — for multi-photo gallery
- `ArchivedMember`: Member with archived flag and archivedAt timestamp
- `MemberListItem`: lightweight projection for list views (id, name, avatar, color, archived)

## Acceptance Criteria

- [x] System type with avatarRef, displayName, settingsId
- [x] Member type with completenessLevel as actual field
- [x] CompletenessLevel union type with exhaustive handling
- [x] RoleTag as discriminated union: known tags vs custom with value
- [x] MemberPhoto type for multi-photo gallery (ordered collection)
- [x] Separate Member and MemberListItem types (full vs projection)
- [x] All types documented with JSDoc comments
- [x] Type-level tests for all identity types (27 tests)

## References

- features.md section 1 (Identity Management)
- CLAUDE.md terminology: "member" not "alter" in code

## Summary of Changes

Implemented core identity types in packages/types/src/identity.ts:

- System: id, name, displayName, description, avatarRef, settingsId, audit fields
- Member: id, systemId, name, pronouns, description, avatarRef, colors, completenessLevel, roleTags, audit fields
- CompletenessLevel: fragment | demi-member | full
- RoleTag: discriminated union with 9 KnownRoleTags + custom
- MemberPhoto: multi-photo gallery with sort order
- ArchivedMember: extends Member with archived flag and timestamp
- MemberListItem: lightweight projection for list views

## Post-Review Fixes

- RoleTag redesigned with explicit kind discriminant: { kind: 'known', tag: KnownRoleTag } | { kind: 'custom', value: string }
- Member now extends AuditMetadata (removes inline audit fields)
- Member has archived: false literal field
- System now extends AuditMetadata (removes inline audit fields)
- ArchivedMember changed from interface extends to type alias with Omit (archived: false -> true)
- MemberPhoto.id changed from BlobId to MemberPhotoId
- MemberPhoto.ref renamed to blobRef
- Composition and barrel export tests added
