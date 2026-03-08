---
# types-itej
title: Fronting and switching types
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:09Z
updated_at: 2026-03-08T14:21:27Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Fronting, switching, and custom front types.

## Scope

- `FrontingSession`: modeled as discriminated union:
  - `ActiveFrontingSession`: id, systemId, memberId, startTime (UnixMillis), endTime: null, frontingType ('fronting' | 'co-conscious'), comment (string, max 50 chars), customFrontId (nullable), subsystemId (nullable)
  - `CompletedFrontingSession`: same but endTime: UnixMillis (non-null)
  - `frontingType`: user-specified, not computed from overlap. Co-conscious (passive awareness) is distinct from co-fronting (active control) and requires explicit input.
- `Switch`: id, systemId, timestamp, outgoingMemberIds, incomingMemberIds
- `CustomFront`: id (CustomFrontId), systemId, name, description, color, avatarRef (BlobId | null), archived (boolean), subsystemId (nullable), createdAt, updatedAt — abstract cognitive state logged like a member
- `CoFrontState`: derived type for currently-fronting members at a point in time (computed, not stored)
- `FrontingType`: 'fronting' | 'co-conscious'

## Acceptance Criteria

- [ ] FrontingSession as discriminated union (active vs completed)
- [ ] frontingType on FrontingSession (user-specified, not computed)
- [ ] Switch event links outgoing and incoming members
- [ ] CustomFront with avatarRef, archived, subsystemId, timestamps
- [ ] Comment field enforces max 50 character constraint at type level
- [ ] CoFrontState computed type
- [ ] Subsystem fronting supported via optional subsystemId
- [ ] Unit tests for type construction and validation

## References

- features.md section 2 (Fronting and Analytics)
- CLAUDE.md: "fronting" not "presenting", "switch" not "transition"
