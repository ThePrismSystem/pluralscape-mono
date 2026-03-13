---
# db-b7vb
title: Align webhook_deliveries terminal cleanup index between PG and SQLite
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nReplaced SQLite composite `(status, created_at)` index with a partial index matching PG: `webhook_deliveries_terminal_created_at_idx ON (created_at) WHERE status IN ('success', 'failed')`.
