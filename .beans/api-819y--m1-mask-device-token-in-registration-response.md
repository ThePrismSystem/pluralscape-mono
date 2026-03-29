---
# api-819y
title: "M1: Mask device token in registration response"
status: completed
type: bug
priority: normal
created_at: 2026-03-28T21:26:48Z
updated_at: 2026-03-29T00:48:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M1 (Security)
**File:** `apps/api/src/services/device-token.service.ts:49-65`

`registerDeviceToken` returns full unmasked push token. `listDeviceTokens` properly masks with `***${token.slice(-8)}`. Inconsistent — plaintext token in response risks exposure via logging/caching.

**Fix:** Mask the token in registration response or return only id+metadata (client already has the token).
