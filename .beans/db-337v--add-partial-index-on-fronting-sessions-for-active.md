---
# db-337v
title: Add partial index on fronting_sessions for active fronters
status: todo
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

getCurrentFronters queries WHERE system_id=? AND end_time IS NULL. Index on (system_id, start_time) does not cover end_time. At 1.8B rows, needs partial index WHERE end_time IS NULL on (system_id). Ref: audit H10
