---
# api-lp2u
title: "L5: Add safety limit to listFriendNotificationPreferences"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:27:45Z
updated_at: 2026-03-28T21:27:45Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L5 (Performance)
**File:** `apps/api/src/services/friend-notification-preference.service.ts:185-205`

Returns all non-archived preferences without a limit. Bounded by friend count in practice but no explicit safety cap.

**Fix:** Add `.limit(MAX_PAGE_LIMIT)` as a safety cap.
