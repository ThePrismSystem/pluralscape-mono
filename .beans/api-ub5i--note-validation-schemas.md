---
# api-ub5i
title: Note validation schemas
status: completed
type: task
priority: critical
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T14:17:53Z
parent: api-i16z
---

packages/validation/src/note.ts — Create/Update/List/Archive/Delete schemas. Create schema accepts polymorphic author: EntityReference<member|structure-entity> (optional, null = system-wide). List supports filter by author entity or system-wide. Tests: unit tests (member-bound, structure-entity-bound, system-wide).

## Summary of Changes

Created `packages/validation/src/note.ts` with:

- `CreateNoteBodySchema`: encryptedData + optional polymorphic author (entityType + entityId)
- `UpdateNoteBodySchema`: encryptedData + version (OCC)
- `NoteQuerySchema`: includeArchived, authorEntityType, authorEntityId, systemWide filters

23 unit tests in `packages/validation/src/__tests__/note.test.ts`.
