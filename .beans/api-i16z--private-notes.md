---
# api-i16z
title: Private notes
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T05:59:18Z
parent: ps-53up
---

Member-bound, system-wide, rich text

### Deletion pattern

Notes: leaf entities, always deletable. Archival always allowed regardless of dependents.

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
