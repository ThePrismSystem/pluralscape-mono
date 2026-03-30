---
# api-sas4
title: "Fix all PR #329 review issues"
status: completed
type: task
priority: high
created_at: 2026-03-30T03:56:31Z
updated_at: 2026-03-30T06:22:45Z
---

Address all 20 review items from PR #329 multi-model review: 3 critical, 4 important, 6 simplifications, 2 type fixes, 5 test gaps.

## Summary of Changes

All 13 actionable PR #329 review issues addressed (issue #4 was intentional by design):

### Critical Security (Issues 1, 2)

- Fronting session sync now applies bucket filtering via bucketContentTags join
- updateLifecycleEvent DB read moved before validation; metadata always validated against real event type

### Simple Important (Issues 3, 8, 14)

- MAX_PAGE_LIMIT cap added to structure entity association, link, and member-link services
- verifyAccountPin uses withAccountTransaction (was withAccountRead)
- Snapshot list uses descending order (newest first)

### Type Safety (Issues 5, 6, 10, 11)

- FieldValueOwner uses exhaustive switch instead of cast
- FriendConnectionStatus uses type guard instead of cast
- FriendDashboardSyncEntry.entityType typed as union (was string)
- UpdateDeviceTokenBodySchema has .readonly()

### Moderate Complexity (Issues 7, 9, 13)

- Cycle detection and MAX_DEPTH_EXCEEDED checks in createEntityLink
- verifyPasswordOffload wired into account-deletion and system-purge services
- Device token update eliminates double-fetch with conditional SET

### Code Deduplication (Issue 12)

- accept/reject friend routes consolidated via createFriendActionRoute factory

### Follow-up

- Created bean api-h908 for service-level test coverage gaps
