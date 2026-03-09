---
# types-c2eu
title: Group and folder types
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:32:13Z
updated_at: 2026-03-09T00:50:52Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Group and folder hierarchy types.

## Scope

- `Group`: id (GroupId), systemId, name, image (ref), description, color (hex), emoji, parentGroupId (nullable — enables hierarchy), sortOrder (number), archived (boolean), archivedAt (UnixMillis | null), createdAt, updatedAt
- `GroupMembership`: groupId, memberId (M:N relationship)
- `GroupTree`: recursive type for rendering nested folder structures
- `GroupMoveOperation`: sourceGroupId, targetParentGroupId — for drag-and-drop

## Acceptance Criteria

- [x] Group with AuditMetadata, archived, archivedAt, color, emoji, imageRef
- [x] Hierarchical nesting via nullable parentGroupId
- [x] GroupMembership junction type
- [x] GroupTree recursive intersection type (Group & children)
- [x] sortOrder field on Group
- [x] Unit tests for all group types

## References

- features.md section 1 (Groups/folders)

## Summary of Changes

Implemented in `packages/types/src/groups.ts`:

- `Group` with AuditMetadata, parentGroupId, imageRef, color, emoji, sortOrder, archived/archivedAt
- `GroupMembership` 2-field junction
- `GroupTree` recursive intersection type
- `GroupMoveOperation` with nullable targetParentGroupId
- Full test coverage in `groups.test.ts`
