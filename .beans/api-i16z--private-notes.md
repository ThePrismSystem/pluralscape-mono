---
# api-i16z
title: Private notes
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T15:19:42Z
parent: ps-53up
---

Member-bound, system-wide, rich text

## Scope

Rich text notes that can be member-bound, structure-entity-bound, or system-wide. Authors are polymorphic: EntityReference<"member" | "structure-entity"> (null = system-wide). Content is T1 encrypted; author reference is T3 plaintext. Notes are leaf entities (always deletable). Gets its own NoteDocument CRDT schema (independent from ChatDocument).

### Deletion pattern

Notes are leaf entities — always deletable. Archival always allowed.

## Acceptance Criteria

- Note CRUD with polymorphic author (member or structure entity), system-wide (null author)
- List with filter by author entity type/ID or system-wide, cursor pagination
- Archive/restore lifecycle
- Own NoteDocument CRDT schema wired into sync engine
- Lifecycle events for all mutations
- Unit tests: 85%+ coverage, member vs structure-entity vs system-wide filtering branches
- Integration tests: PGlite with real DB ops, RLS enforcement
- E2E tests: full CRUD, author filtering, archive/restore/delete

## Design References

- `packages/db/src/schema/pg/communication.ts` — notes table (memberId FK)
- `packages/types/src/encryption.ts` — ServerNote type
- `packages/types/src/utility.ts` — EntityReference polymorphic pattern
- `packages/types/src/journal.ts` — Journal entry author pattern (exemplar for polymorphic authorship)

## Summary of Changes

Implemented full Private Notes API with polymorphic authorship (member, structure-entity, or system-wide). All 6 child tasks completed:

- DB schema updated: `memberId` → `authorEntityType` + `authorEntityId` (PG + SQLite)
- Types updated: `Note.author`, `ServerNote.authorEntityType/authorEntityId`, 5 audit event types
- Validation schemas: create, update, query with author filtering
- CRUD service: create, get, list (cursor pagination, author filtering), update (OCC), delete, archive, restore
- API routes: 8 route files registered at `/:systemId/notes`
- CRDT sync: standalone NoteDocument schema, document factory, time-split config
- E2E tests: lifecycle, filtering, OCC, error cases
- Migrations regenerated from scratch
