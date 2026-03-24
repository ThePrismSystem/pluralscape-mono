---
# api-4kp6
title: Add next_check_in_at column to optimize timer scheduling
status: todo
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-03-24T09:25:31Z
parent: ps-4ioj
---

check-in-generate job scans ALL enabled timer configs globally. Add next_check_in_at column and partial index to query only due configs.
