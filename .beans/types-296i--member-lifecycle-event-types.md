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

Append-only lifecycle event log types modeled as a discriminated union.

## Scope

`LifecycleEvent` is a discriminated union on `eventType`. Each variant carries type-specific fields:

- `SplitEvent`: eventType 'split', sourceMemberId (MemberId), resultingMemberIds (MemberId[]), timestamp, notes
- `FusionEvent`: eventType 'fusion', sourceMemberIds (MemberId[]), resultingMemberId (MemberId), timestamp, notes — permanent combination
- `MergeEvent`: eventType 'merge', memberIds (MemberId[]), timestamp, notes — temporary blurring
- `UnmergeEvent`: eventType 'unmerge', memberIds (MemberId[]), timestamp, notes — reversal of merge
- `DormancyStartEvent`: eventType 'dormancy-start', memberId (MemberId), timestamp, notes
- `DormancyEndEvent`: eventType 'dormancy-end', memberId (MemberId), timestamp, notes
- `DiscoveryEvent`: eventType 'discovery', memberId (MemberId), timestamp, notes
- `ArchivalEvent`: eventType 'archival', memberId (MemberId), timestamp, notes

All variants share: id (EventId), systemId, timestamp (UnixMillis), notes (string | null)

Append-only semantics: no update/delete operations.

## Acceptance Criteria

- [ ] LifecycleEvent as discriminated union on eventType
- [ ] Split requires sourceMemberId + resultingMemberIds
- [ ] Fusion requires sourceMemberIds + resultingMemberId
- [ ] Merge/unmerge require memberIds array
- [ ] Dormancy/discovery/archival require single memberId
- [ ] Append-only semantics enforced (no update type operations)
- [ ] Unit tests for event creation helpers and type narrowing

## References

- features.md section 6 (Member lifecycle events)
