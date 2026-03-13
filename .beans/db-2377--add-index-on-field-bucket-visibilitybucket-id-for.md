---
# db-2377
title: Add index on field_bucket_visibility.bucket_id for FK cascade
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded `field_bucket_visibility_bucket_id_idx` on `bucket_id` to both PG and SQLite for FK cascade performance.
