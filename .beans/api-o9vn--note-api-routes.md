---
# api-o9vn
title: Note API routes
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T14:29:49Z
parent: api-i16z
blocked_by:
  - api-ub5i
  - api-yirj
---

apps/api/src/routes/notes/ — Standard CRUD + list with ?memberId= and ?structureEntityId= filters. Tests: unit (route validation, auth checks).

## Summary of Changes

Created `apps/api/src/routes/notes/` with 8 route files: create, list, get, update, delete, archive, restore, index. Registered at `/:systemId/notes` in systems index. Follows board-message route pattern exactly.
