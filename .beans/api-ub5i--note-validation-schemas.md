---
# api-ub5i
title: Note validation schemas
status: todo
type: task
priority: critical
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-i16z
---

packages/validation/src/note.ts — Create/Update/List/Archive/Delete schemas. Create schema accepts polymorphic author: EntityReference<member|structure-entity> (optional, null = system-wide). List supports filter by author entity or system-wide. Tests: unit tests (member-bound, structure-entity-bound, system-wide).
