---
# db-gjbu
title: Use interpolated column refs in partial index WHERE clauses
status: completed
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nFixed bare column names in partial index WHERE clauses: `sync_queue_unsynced_idx` (PG) and `account_purge_requests_active_unique_idx` (PG + SQLite) now use interpolated column refs.
