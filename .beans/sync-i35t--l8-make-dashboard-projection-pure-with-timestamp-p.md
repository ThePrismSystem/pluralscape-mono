---
# sync-i35t
title: "L8: Make dashboard projection pure with timestamp parameter"
status: completed
type: task
priority: low
created_at: 2026-03-28T21:27:54Z
updated_at: 2026-03-29T00:48:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L8 (Sync)
**File:** `packages/sync/src/projections/friend-dashboard-projection.ts:19`

`projectDashboardSnapshot` calls `Date.now()` directly instead of accepting a timestamp parameter. Makes projection impure and hard to test. Other projections accept timestamps.

**Fix:** Accept `nowMs?: number` parameter, defaulting to `Date.now()`.
