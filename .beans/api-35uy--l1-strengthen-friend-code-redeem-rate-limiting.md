---
# api-35uy
title: "L1: Strengthen friend code redeem rate limiting"
status: completed
type: task
priority: low
created_at: 2026-03-28T21:27:31Z
updated_at: 2026-03-28T22:00:09Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L1 (Security)
**File:** `apps/api/src/services/friend-code.service.ts:282`

Friend codes have ~41 bits entropy (8 alphanumeric chars) with standard write rate limiting. Not immediately exploitable but warrants stricter controls.

**Fix:** Apply stricter rate-limit category (e.g., `authCritical`) or add failed-attempt counter per IP.

## Summary of Changes

Added a new `friendCodeRedeem` rate limit category (5 requests/minute) in `packages/types/src/api-constants.ts` and applied it to the redeem route instead of the generic `write` category (60 requests/minute). This limits brute-force attempts against the ~41-bit entropy friend code space. Added a route-level test asserting the correct rate limit category is used.
