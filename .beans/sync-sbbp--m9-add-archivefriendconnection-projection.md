---
# sync-sbbp
title: "M9: Add archiveFriendConnection projection"
status: todo
type: task
priority: normal
created_at: 2026-03-28T21:27:17Z
updated_at: 2026-03-28T21:27:17Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M9 (Sync)
**File:** `packages/sync/src/projections/friend-projection.ts`

`archiveFriendCodeProjection` exists for codes but no equivalent for connections. The `CrdtFriendConnection` schema has an `archived` field but no projection sets it.

**Fix:** Add `archiveFriendConnectionProjection` mirroring the code archival pattern.
