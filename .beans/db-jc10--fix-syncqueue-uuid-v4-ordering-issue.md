---
# db-jc10
title: Fix syncQueue UUID v4 ordering issue
status: completed
type: bug
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T06:30:59Z
parent: db-2nr7
---

Code comment acknowledges UUID PKs don't guarantee insertion order but takes no action. Switch to UUIDv7 or add autoincrement sequence for replay ordering. Ref: audit M7

## Summary of Changes\n\nAdded `sync-queue-cleanup` to `JobType` union and `JOB_TYPES` enum array. Updated exhaustive type tests.
