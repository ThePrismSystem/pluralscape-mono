---
# sync-nm0n
title: "M10: Add M6 projection barrel exports"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:27:19Z
updated_at: 2026-03-29T00:48:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M10 (Sync)
**File:** `packages/sync/src/index.ts`

Neither `projections/friend-projection.ts` nor `projections/friend-dashboard-projection.ts` are exported from the barrel. Consumers must use deep imports.

**Fix:** Add projection exports to `index.ts` or a sub-entry point.
