---
# sync-5jne
title: Merge semantics specification
status: todo
type: task
priority: high
created_at: 2026-03-08T13:35:14Z
updated_at: 2026-03-08T13:36:27Z
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

- [ ] Merge strategy documented for every entity type
- [ ] Append-only entities identified and enforced
- [ ] LWW entities: field-level granularity (not record-level)
- [ ] Tree merge: reparenting conflict resolution defined
- [ ] Set operations: add-wins semantics for relationships
- [ ] Written as specification in packages/sync/docs/
- [ ] Integration tests demonstrating each merge strategy

## References

- ADR 005
