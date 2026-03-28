---
# api-72bg
title: "L2: Validate deviceTokenId ownership in push worker"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:27:35Z
updated_at: 2026-03-28T21:27:35Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L2 (Security)
**File:** `apps/api/src/services/push-notification-worker.ts:62-72`

Push worker reads device tokens without RLS (intentional for background). Accepts `deviceTokenId` from job payload without verifying account ownership. Corrupted payload could access any token.

**Fix:** Include account ID in job payload and add it to the WHERE clause.
