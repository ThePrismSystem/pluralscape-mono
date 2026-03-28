---
# api-kq93
title: "H1: Fix device token takeover via upsert"
status: todo
type: bug
priority: critical
created_at: 2026-03-28T21:26:20Z
updated_at: 2026-03-28T21:26:20Z
parent: ps-tkuz
---

**Audit:** M6 audit finding H1 (Security)
**File:** `apps/api/src/services/device-token.service.ts:97-105`

The `onConflictDoUpdate` on `(token, platform)` reassigns ownership of any existing device token to the caller's account. An attacker who knows/guesses a push token can hijack notification delivery.

**Fix:** On conflict, verify `accountId` matches before updating. If the token belongs to a different account, return a conflict error or silently no-op.
