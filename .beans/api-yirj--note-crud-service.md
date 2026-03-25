---
# api-yirj
title: Note CRUD service
status: todo
type: task
priority: high
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-i16z
blocked_by:
  - api-ub5i
  - api-d0ej
---

apps/api/src/services/note.service.ts — Create (with optional polymorphic author: member or structure entity), get, list (filter by author entity or system-wide, cursor pagination), update, archive/restore, delete. Leaf entity (always deletable). RLS-wrapped. Tests: unit (all branches, member vs structure-entity vs system-wide filtering) + integration (PGlite). 85%+ coverage.
