---
# api-pyy1
title: "M3: Push bucket filtering into SQL for dashboard queries"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:26:57Z
updated_at: 2026-03-29T00:48:45Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M3 (Performance)
**File:** `apps/api/src/services/friend-dashboard.service.ts:162-242`

`queryVisibleMembers/CustomFronts/StructureEntities` fetch all rows then filter in memory. The friend-export service uses JOIN-based filtering at the SQL level.

**Fix:** Use JOIN on `bucket_content_tags` with `inArray(bucketContentTags.bucketId, friendBucketIds)` so Postgres filters instead of loading all blobs into memory.
