---
# api-k4su
title: "M4: Batch manifest COUNT queries in export services"
status: todo
type: task
priority: normal
created_at: 2026-03-28T21:27:01Z
updated_at: 2026-03-28T21:27:01Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M4 (Performance)
**Files:** `apps/api/src/services/bucket-export.service.ts:74-89` and `friend-export.service.ts:80-102`

Both `buildManifestEntries` fire `Promise.all` over 21 entity types, each a `SELECT COUNT(*)`. 21 concurrent DB queries per manifest request risks connection pool contention.

**Fix:** Use a single UNION ALL query across entity types, batch into fewer groups, or cache results with short TTL keyed by ETag.
