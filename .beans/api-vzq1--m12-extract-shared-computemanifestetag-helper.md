---
# api-vzq1
title: "M12: Extract shared computeManifestEtag helper"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:27:24Z
updated_at: 2026-03-28T22:01:45Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M12 (Refactor)
**Files:** `apps/api/src/services/friend-export.service.ts:60-68` and `bucket-export.service.ts:55-62`

Identical `globalMaxUpdatedAt` reduce + `computeDataEtag` call duplicated across both export services.

**Fix:** Extract `computeManifestEtag(entries)` into `lib/etag.ts`.
