---
# api-21xr
title: "M11: Extract generic queryVisibleEntities helper"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:27:22Z
updated_at: 2026-03-29T00:48:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M11 (Refactor)
**File:** `apps/api/src/services/friend-dashboard.service.ts:153-242`

`queryVisibleMembers`, `queryVisibleCustomFronts`, `queryVisibleStructureEntities` follow identical pattern: early-return, SELECT, loadBucketTags, filterVisibleEntities, map.

**Fix:** Extract generic `queryVisibleEntities(tx, table, entityType, systemId, friendBucketIds, mapFn)`.
