---
# sync-5jne
title: Merge semantics specification
status: completed
type: task
priority: high
created_at: 2026-03-08T13:35:14Z
updated_at: 2026-03-14T23:59:16Z
parent: sync-xlhb
blocking:
  - sync-80bn
---

Design document: merge semantics for each entity type in the domain model. Output is a specification, not code.

## Scope

- Per-entity merge strategy:
  - Fronting sessions: append-only (no conflict possible)
  - Chat messages: append-only, ordered by Lamport timestamp
  - Member profiles: last-writer-wins (LWW) per field
  - Groups: tree merge with reparenting conflict resolution
  - Custom fields: LWW per field value
  - System structure relationships: set add/remove operations (add-wins semantics)
  - Lifecycle events: append-only
  - Nomenclature settings: LWW per term category
  - Innerworld positions: LWW per entity
- Automerge-native types: use Automerge.Text for rich text, Automerge.Counter for numeric accumulators
- Document merge strategy for each topology document type

## Acceptance Criteria

- [x] Merge strategy documented for every entity type
- [x] Append-only entities identified and enforced
- [x] LWW entities: field-level granularity (not record-level)
- [x] Tree merge: reparenting conflict resolution defined
- [x] Set operations: add-wins semantics for relationships
- [x] Written as specification in packages/sync/docs/
- [x] Integration tests demonstrating each merge strategy

## References

- ADR 005

## Summary of Changes

- Added 3 missing integration test categories to `conflict-resolution.test.ts`:
  - Cat 4: concurrent re-parenting creating group hierarchy cycles
  - Cat 8: concurrent sort order reorders converging to consistent (possibly inverted) state
  - Cat 9: ChatMessage edit chain integrity after concurrent appends
- Renumbered existing test categories (4→6 junction, 6→7 CheckInRecord, 7→10 FriendConnection) to match spec
- Added `createChatDocument` import for Cat 9 test
- Added "Document-Level Merge Semantics" section to `conflict-resolution.md` summarizing merge profiles for all 6 document types
- Added "Automerge.Text deferred to V2" and "Automerge.Counter not used" design decisions to spec
- All 141 tests pass; typecheck and lint clean
