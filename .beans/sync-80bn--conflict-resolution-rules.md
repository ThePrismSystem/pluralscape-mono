---
# sync-80bn
title: Conflict resolution rules
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:35:22Z
updated_at: 2026-03-15T00:55:27Z
parent: sync-xlhb
---

Design document: conflict detection and resolution rules for concurrent edits. Output is a specification, not code.

## Scope

- Conflict detection: concurrent edits to same field on different devices
- Resolution strategies:
  - LWW with Lamport timestamps (most entities)
  - Union strategy for co-fronting (both concurrent fronting sessions valid)
  - Tombstone handling: archived/deleted items use tombstones
- Edge cases:
  - Same member edited on two offline devices simultaneously
  - Group reparented to different parents concurrently
  - Member archived on one device, edited on another
- Conflict notification type for surfacing to UI (informational, not blocking)
- No user-prompt conflicts in V1 (all auto-resolved)

## Acceptance Criteria

- [ ] Conflict resolution rules specified for each entity type
- [ ] Edge cases documented with expected resolution
- [ ] Tombstone pattern for archival and permanent deletion
- [ ] Conflict notification type defined
- [ ] All conflicts auto-resolved (no user intervention in V1)
- [ ] Integration tests for each edge case

## References

- ADR 005
- encryption-research.md section 8.6

## Cross-References

- This specification provides the design input for sync-p1uq (Conflict resolution epic, M3), which will implement these rules in code

## Summary of Changes

- Extended conflict-resolution.md with Tombstone Lifecycle section (archival semantics, sync behavior, bucket projection, no hard delete, compaction, cross-doc references)
- Added Conflict Notifications section (ephemeral, client-side, informational)
- Added Validation Function Signatures table (detectHierarchyCycles, normalizeSortOrder, normalizeCheckInRecord, normalizeFriendConnection)
- Added types to packages/sync/src/types.ts: ConflictNotification, ConflictResolutionStrategy, CycleBreak, SortOrderPatch, PostMergeValidationResult
- Added 14 new tests: tombstone lifecycle (6), subsystem/region hierarchy cycles (2), multi-level edit chains (2), sort order ties (2), concurrent edits to same message (2)
