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

System, Member, CompletenessLevel, RoleTag, MemberPhoto, ArchivedMember types

Core identity types for System and Member entities.

## Scope

- `System`: id (SystemId), name, description, createdAt, settings ref
- `Member`: id (MemberId), systemId, name, pronouns (string[]), description (rich text string), avatarRef, colors (string[] — multiple hex colors), createdAt, updatedAt
- `CompletenessLevel`: 'fragment' | 'demi-member' | 'full' — nullable fields vary by level
- `RoleTag`: 'protector' | 'gatekeeper' | 'caretaker' | 'little' | 'age-slider' | 'trauma-holder' | 'host' | 'persecutor' | 'mediator' | custom string
- `MemberPhoto`: id, memberId, url/ref, sortOrder, caption — for multi-photo gallery
- `ArchivedMember`: Member with archived flag and archivedAt timestamp
- `MemberListItem`: lightweight projection for list views (id, name, avatar, color, archived)

## Acceptance Criteria

- [ ] System type defined with all fields
- [ ] Member type defined with all fields from features.md section 1
- [ ] CompletenessLevel union type with exhaustive handling
- [ ] RoleTag supports both preset values and custom strings
- [ ] MemberPhoto type for multi-photo gallery (ordered collection)
- [ ] Separate Member and MemberListItem types (full vs projection)
- [ ] All fields documented with JSDoc comments
- [ ] Unit tests for type guards and creation helpers

## References

- features.md section 1 (Identity Management)
- CLAUDE.md terminology: "member" not "alter" in code

## Audit Findings (002)

- Missing `completenessLevel` field on Member type (defined as separate union but not as a field on Member)
- Missing rich-linking metadata on `description` field (links to members/groups/entities with preview cards per features.md section 1)
- System type needs `settings` to reference a concrete `SystemSettings` type (not just "ref") covering app lock, notification prefs, nomenclature, littles safe mode config
- `RoleTag` needs discriminated union pattern: `{ tag: 'protector' } | { tag: 'custom', value: string }` instead of plain string mixing known values with custom
- Missing `archived` flag on Group type referenced from types-c2eu
