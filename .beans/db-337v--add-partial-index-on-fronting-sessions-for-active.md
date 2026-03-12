---
# db-337v
title: Add partial index on fronting_sessions for active fronters
status: completed
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

getCurrentFronters queries WHERE system_id=? AND end_time IS NULL. Index on (system_id, start_time) does not cover end_time. At 1.8B rows, needs partial index WHERE end_time IS NULL on (system_id). Ref: audit H10

## Summary of Changes\n\nAdded partial index `fronting_sessions_active_idx` on `system_id` WHERE `end_time IS NULL` to both PG and SQLite schemas.
