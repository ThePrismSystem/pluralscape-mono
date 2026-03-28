---
# api-t4xn
title: "M6: Extract generic isPgErrorCode helper"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:27:08Z
updated_at: 2026-03-28T22:03:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M6 (Quality)
**File:** `apps/api/src/services/friend-notification-preference.service.ts:210-226`

`isFkViolation` is a near-copy of `isUniqueViolation` with different error code. `MAX_CAUSE_DEPTH` and cause-chain walking duplicated verbatim.

**Fix:** Extract generic `isPgErrorCode(error, code)` into `lib/pg-error.ts`. Compose both `isUniqueViolation` and `isFkViolation` from it.

## Summary of Changes

Created `apps/api/src/lib/pg-error.ts` with generic `isPgErrorCode(error, code)` helper that walks the `.cause` chain up to 10 levels. Refactored `isUniqueViolation` in `lib/unique-violation.ts` to delegate to `isPgErrorCode`. Added comprehensive unit tests in `src/__tests__/lib/pg-error.test.ts`.
