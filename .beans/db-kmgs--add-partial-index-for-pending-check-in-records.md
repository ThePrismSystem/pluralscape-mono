---
# db-kmgs
title: Add partial index for pending check-in records
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded `check_in_records_system_pending_idx` partial index on `(system_id, scheduled_at) WHERE responded_at IS NULL AND dismissed = false` to both PG and SQLite.
