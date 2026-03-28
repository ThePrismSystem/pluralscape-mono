---
# api-37ii
title: "H5: Extract shared export table infrastructure"
status: completed
type: task
priority: high
created_at: 2026-03-28T21:26:35Z
updated_at: 2026-03-28T22:01:45Z
parent: ps-tkuz
---

**Audit:** M6 audit finding H5 (Refactor)
**Files:** `apps/api/src/services/friend-export.constants.ts:96-133` and `apps/api/src/services/bucket-export.constants.ts:83-128`

`ExportTableRef`/`BucketExportTableRef` interfaces, `exportRef()`, and `keysetAfter()` are duplicated verbatim between the two files.

**Fix:** Extract shared `lib/export-table-ref.ts` with the interface, `exportRef()`, and `keysetAfter()`.
