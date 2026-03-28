---
# api-v9ur
title: "L9: Move isFkViolation to shared lib/pg-error.ts"
status: completed
type: task
priority: low
created_at: 2026-03-28T21:27:57Z
updated_at: 2026-03-28T22:03:44Z
parent: ps-tkuz
blocked_by:
  - api-t4xn
---

**Audit:** M6 audit finding L9 (Refactor)
**File:** `apps/api/src/services/friend-notification-preference.service.ts`

Local `isFkViolation` utility useful elsewhere. Should be co-located with `isUniqueViolation`. Overlaps with M6 finding (api-t4xn).

**Fix:** Move to `lib/pg-error.ts` as part of M6 remediation. Can be combined with api-t4xn.

## Summary of Changes

Exported `isFkViolation` from `lib/pg-error.ts` (composed from `isPgErrorCode`). Removed inline copy from `friend-notification-preference.service.ts` and updated import to use the shared lib.
