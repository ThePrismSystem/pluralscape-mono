---
# api-4kp6
title: Add next_check_in_at column to optimize timer scheduling
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-14T14:53:23Z
parent: ps-4ioj
---

check-in-generate job scans ALL enabled timer configs globally. Add next_check_in_at column and partial index to query only due configs.

## Summary of Changes\n\nAdded next_check_in_at column to timer_configs (PG + SQLite). Updated check-in-generate job to query only due configs. Added computeNextCheckInAt helper with waking hours support. Timer config service sets/clears nextCheckInAt on create/update.
