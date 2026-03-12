---
# db-gx66
title: Add index on friend_bucket_assignments.bucket_id
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

Privacy checks resolving which buckets a friend is assigned to need WHERE bucket_id=? — currently requires full PK b-tree scan from wrong side. Ref: audit M26

## Summary of Changes\n\nAdded `friend_bucket_assignments_bucket_id_idx` index on bucket_id for both PG and SQLite.
