---
# api-sg8l
title: "L10: Deduplicate notification config upsert logic"
status: completed
type: task
priority: low
created_at: 2026-03-28T21:28:00Z
updated_at: 2026-03-28T22:03:44Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L10 (Refactor)
**File:** `apps/api/src/services/notification-config.service.ts:65-195`

`getOrCreateNotificationConfig` and `updateNotificationConfig` both contain identical "create with defaults" insert blocks.

**Fix:** Extract single `upsertNotificationConfig` internal helper.

## Summary of Changes

Extracted `insertNotificationConfig` private helper in `notification-config.service.ts` that both `getOrCreateNotificationConfig` and `updateNotificationConfig` delegate to, eliminating the duplicated insert block.
