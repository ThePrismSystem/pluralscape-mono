---
# api-35uy
title: "L1: Strengthen friend code redeem rate limiting"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:27:31Z
updated_at: 2026-03-28T21:27:31Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L1 (Security)
**File:** `apps/api/src/services/friend-code.service.ts:282`

Friend codes have ~41 bits entropy (8 alphanumeric chars) with standard write rate limiting. Not immediately exploitable but warrants stricter controls.

**Fix:** Apply stricter rate-limit category (e.g., `authCritical`) or add failed-attempt counter per IP.
