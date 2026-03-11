---
# db-ncuh
title: Add CHECK constraints for wakingStart/wakingEnd time format
status: todo
type: task
created_at: 2026-03-11T11:12:20Z
updated_at: 2026-03-11T11:12:20Z
---

wakingStart and wakingEnd columns store time-of-day strings (e.g. '09:00') but lack format validation. Add CHECK constraints to enforce HH:MM format.
