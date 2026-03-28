---
# api-0hmp
title: "H6: Consolidate block/remove friend connection methods"
status: todo
type: task
priority: high
created_at: 2026-03-28T21:26:41Z
updated_at: 2026-03-28T21:26:41Z
parent: ps-tkuz
---

**Audit:** M6 audit finding H6 (Refactor)
**File:** `apps/api/src/services/friend-connection.service.ts:310-448`

`blockFriendConnection` and `removeFriendConnection` (~60 lines each) follow identical structure: transitionConnectionStatus -> updateReverseConnection -> find reverse -> cleanupBucketAssignments -> return pendingRotations.

**Fix:** Consolidate into a single private `terminateConnection(db, accountId, connectionId, auth, audit, config)` parameterized by target status.
