---
# db-ncuh
title: Add CHECK constraints for wakingStart/wakingEnd time format
status: completed
type: task
priority: normal
created_at: 2026-03-11T11:12:20Z
updated_at: 2026-03-12T23:23:07Z
---

wakingStart and wakingEnd columns store time-of-day strings (e.g. '09:00') but lack format validation. Add CHECK constraints to enforce HH:MM format.

## Summary of Changes\n\nAdded HH:MM time format CHECK constraints for `wakingStart` and `wakingEnd` columns:\n- `pgTimeFormatCheck()` using PG regex operator `~`\n- `sqliteTimeFormatCheck()` using `length()`/`substr()` character-level validation\n- Both helpers in `packages/db/src/helpers/check.ts`\n- Constraints added to both PG and SQLite `timerConfigs` table definitions\n- Test DDL updated, integration tests added (valid times accepted, invalid rejected)
