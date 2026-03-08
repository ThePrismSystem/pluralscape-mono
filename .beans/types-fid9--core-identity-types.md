---
# types-fid9
title: Core identity types
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:06Z
updated_at: 2026-03-08T14:21:21Z
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

- [ ] System type with avatarRef, displayName, settingsId
- [ ] Member type with completenessLevel as actual field
- [ ] CompletenessLevel union type with exhaustive handling
- [ ] RoleTag as discriminated union: known tags vs custom with value
- [ ] MemberPhoto type for multi-photo gallery (ordered collection)
- [ ] Separate Member and MemberListItem types (full vs projection)
- [ ] All fields documented with JSDoc comments
- [ ] Unit tests for type guards and creation helpers

## References

- features.md section 1 (Identity Management)
- CLAUDE.md terminology: "member" not "alter" in code
