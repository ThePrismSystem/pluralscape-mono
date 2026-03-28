---
# api-t4xn
title: "M6: Extract generic isPgErrorCode helper"
status: todo
type: task
priority: normal
created_at: 2026-03-28T21:27:08Z
updated_at: 2026-03-28T21:27:08Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M6 (Quality)
**File:** `apps/api/src/services/friend-notification-preference.service.ts:210-226`

`isFkViolation` is a near-copy of `isUniqueViolation` with different error code. `MAX_CAUSE_DEPTH` and cause-chain walking duplicated verbatim.

**Fix:** Extract generic `isPgErrorCode(error, code)` into `lib/pg-error.ts`. Compose both `isUniqueViolation` and `isFkViolation` from it.
