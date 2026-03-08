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

Group hierarchy, GroupMembership, GroupTree recursive type, drag-and-drop operations

Group and folder hierarchy types.

## Scope

- `Group`: id (GroupId), systemId, name, image (ref), description, color (hex), emoji, parentGroupId (nullable — enables hierarchy), sortOrder (number)
- `GroupMembership`: groupId, memberId (M:N relationship)
- `GroupTree`: recursive type for rendering nested folder structures
- `GroupMoveOperation`: sourceGroupId, targetParentGroupId — for drag-and-drop

## Acceptance Criteria

- [ ] Group supports hierarchical nesting via parentGroupId
- [ ] Multi-group membership (member can belong to many groups)
- [ ] GroupTree recursive type for tree rendering
- [ ] Sort order for drag-and-drop reorder
- [ ] Group has image, description, color, and emoji fields
- [ ] Unit tests for tree construction helpers

## References

- features.md section 1 (Groups/folders)

## Audit Findings (002)

- Group missing `archived` flag (features.md section 1: archival is non-destructive)
