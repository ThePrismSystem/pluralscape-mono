---
# api-ud77
title: "L7: Replace as SQL cast with runtime guard in friend-export"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:27:51Z
updated_at: 2026-03-28T21:27:51Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L7 (Quality)
**File:** `apps/api/src/services/friend-export.constants.ts:93`

Uses `as SQL` cast for `or()` return type. Bucket-export version correctly throws if `or()` returns undefined.

**Fix:** Replace `as SQL` cast with runtime guard pattern from `bucket-export.constants.ts`.
