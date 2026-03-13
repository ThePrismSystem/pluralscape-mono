---
# db-12b3
title: Add composite index for webhook delivery retry queries
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded `webhook_deliveries_system_retry_idx` partial index on `(system_id, status, next_retry_at) WHERE status NOT IN ('success', 'failed')` to both PG and SQLite.
