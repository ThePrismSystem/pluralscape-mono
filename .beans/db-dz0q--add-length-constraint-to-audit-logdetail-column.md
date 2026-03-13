---
# db-dz0q
title: Add length constraint to audit_log.detail column
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded CHECK `audit_log_detail_length_check` constraining `detail` to 2048 chars max (both PG and SQLite).
