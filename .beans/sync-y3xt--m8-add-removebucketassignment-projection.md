---
# sync-y3xt
title: "M8: Add removeBucketAssignment projection"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:27:14Z
updated_at: 2026-03-29T00:48:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M8 (Sync)
**File:** `packages/sync/src/projections/friend-projection.ts`

`addBucketAssignmentProjection` exists but no `removeBucketAssignmentProjection`. Removing a bucket requires direct CRDT manipulation, breaking the projection abstraction.

**Fix:** Add `removeBucketAssignmentProjection` that deletes the key from `assignedBuckets`.
