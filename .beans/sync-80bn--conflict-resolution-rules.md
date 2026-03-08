---
# sync-80bn
title: Conflict resolution rules
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:35:22Z
updated_at: 2026-03-08T13:35:31Z
parent: sync-xlhb
---

Design document: conflict detection and resolution rules for concurrent edits. Output is a specification, not code.

## Scope

- Conflict detection: concurrent edits to same field on different devices
- Resolution strategies:
  - LWW with Lamport timestamps (most entities)
  - Union strategy for co-fronting (both concurrent fronting sessions valid)
  - Tombstone handling: archived/deleted items use tombstones (non-destructive)
- Edge cases:
  - Same member edited on two offline devices simultaneously
  - Group reparented to different parents concurrently
  - Member archived on one device, edited on another
- Conflict notification type for surfacing to UI (informational, not blocking)
- No user-prompt conflicts in V1 (all auto-resolved)

## Acceptance Criteria

- [ ] Conflict resolution rules specified for each entity type
- [ ] Edge cases documented with expected resolution
- [ ] Tombstone pattern for non-destructive deletion
- [ ] Conflict notification type defined
- [ ] All conflicts auto-resolved (no user intervention in V1)
- [ ] Integration tests for each edge case

## References

- ADR 005
- encryption-research.md section 8.6

## Cross-References

- This specification provides the design input for sync-p1uq (Conflict resolution epic, M3), which will implement these rules in code
