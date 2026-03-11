---
# db-gx66
title: Add index on friend_bucket_assignments.bucket_id
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

Privacy checks resolving which buckets a friend is assigned to need WHERE bucket_id=? — currently requires full PK b-tree scan from wrong side. Ref: audit M26
