---
# db-l1qp
title: Add plain timestamp index to audit_log for range purges
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

Only compound indexes exist. Range-based purge queries (delete events older than 90 days) would force full-index scans. Ref: audit L2

## Summary of Changes\n\nAdded `audit_log_timestamp_idx` for standalone timestamp queries.
