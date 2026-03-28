---
# api-ejjv
title: "L4: Add short-lived cache for loadBucketTags"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:27:42Z
updated_at: 2026-03-28T21:27:42Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L4 (Performance)
**File:** `apps/api/src/services/friend-dashboard.service.ts:295-329`

`getFriendDashboard` runs 3 separate `loadBucketTags` calls. Bucket tag data is relatively stable. Short-lived cache would reduce DB hits on frequently-polled dashboards.

**Fix:** Cache `loadBucketTags` results per `(systemId, entityType)` with 5-15s TTL invalidated on tag mutations.
