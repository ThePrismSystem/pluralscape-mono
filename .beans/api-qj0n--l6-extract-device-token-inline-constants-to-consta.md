---
# api-qj0n
title: "L6: Extract device-token inline constants to constants file"
status: completed
type: task
priority: low
created_at: 2026-03-28T21:27:48Z
updated_at: 2026-03-29T00:48:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L6 (Quality)
**File:** `apps/api/src/services/device-token.service.ts:31,34`

`MAX_DEVICE_TOKENS_PER_LIST` and `TOKEN_MASK_VISIBLE_CHARS` defined inline. Other M6 services extract to `*.constants.ts`.

**Fix:** Create `device-token.constants.ts` and move these constants there.
