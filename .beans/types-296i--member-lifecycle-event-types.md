---
# types-296i
title: Member lifecycle event types
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:23Z
updated_at: 2026-03-08T14:21:53Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Append-only lifecycle events: split, fusion, merge, unmerge, dormancy, discovery, archival

Append-only lifecycle event log types.

## Scope

- `LifecycleEvent`: id (EventId), systemId, eventType, timestamp, involvedMemberIds, resultingMemberIds, notes
- `LifecycleEventType`: 'split' | 'fusion' | 'merge' | 'unmerge' | 'dormancy-start' | 'dormancy-end' | 'discovery' | 'archival'
- Each event type has specific semantics:
  - Split: one member → multiple resulting members
  - Fusion: multiple members → one new member (permanent)
  - Merge: multiple members → temporary blur (reversible via unmerge)
  - Dormancy: member becomes inactive (start/end pair)
  - Discovery: new member found/recognized
  - Archival: member moved to read-only archive

## Acceptance Criteria

- [ ] All 8 lifecycle event types defined
- [ ] Events link involved and resulting members
- [ ] Append-only semantics (no update/delete operations in type)
- [ ] Timestamp and notes per event
- [ ] Split/fusion correctly distinguish permanent vs temporary
- [ ] Unit tests for event creation helpers

## References

- features.md section 6 (Member lifecycle events)

## Audit Findings (002)

- LifecycleEvent should be a discriminated union, not flat eventType field. Split requires resultingMemberIds, dormancy does not. Each variant should have type-specific required/optional fields.
