---
# types-c2eu
title: Group and folder types
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:13Z
updated_at: 2026-03-08T14:21:45Z
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

- [ ] Group with archived, archivedAt, timestamps
- [ ] Hierarchical nesting via parentGroupId
- [ ] Multi-group membership
- [ ] GroupTree recursive type for tree rendering
- [ ] Sort order for drag-and-drop reorder
- [ ] Unit tests for tree construction helpers

## References

- features.md section 1 (Groups/folders)
