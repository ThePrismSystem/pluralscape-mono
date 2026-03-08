---
# types-itej
title: Fronting and switching types
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:09Z
updated_at: 2026-03-08T13:36:09Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

FrontingSession, Switch, CustomFront, CoFrontState, co-fronting as overlapping sessions

Fronting, switching, and custom front types.

## Scope

- `FrontingSession`: id, systemId, memberId, startTime (UnixMillis), endTime (UnixMillis | null), comment (string, max 50 chars), customFrontId (nullable — if this is a custom front session)
- `Switch`: id, systemId, timestamp, outgoingMemberIds, incomingMemberIds
- `CustomFront`: id, systemId, name, description, color — abstract cognitive state logged like a member
- `CoFrontState`: derived type representing currently-fronting members at a point in time (computed, not stored)
- Co-fronting modeled as overlapping FrontingSessions (not mutually exclusive)
- `FrontingType`: 'fronting' | 'co-fronting' | 'co-conscious' distinction
- Subsystem-level fronting: FrontingSession can reference a subsystemId

## Acceptance Criteria

- [ ] FrontingSession supports overlapping time ranges (co-fronting)
- [ ] Switch event links outgoing and incoming members
- [ ] CustomFront type mirrors member-like properties
- [ ] Comment field enforces max 50 character constraint at type level
- [ ] CoFrontState computed type for "who is fronting right now"
- [ ] Subsystem fronting supported via optional subsystemId
- [ ] Unit tests for type construction and validation

## References

- features.md section 2 (Fronting and Analytics)
- CLAUDE.md: "fronting" not "presenting", "switch" not "transition"
