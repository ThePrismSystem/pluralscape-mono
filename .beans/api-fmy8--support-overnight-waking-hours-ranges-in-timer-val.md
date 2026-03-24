---
# api-fmy8
title: Support overnight waking hours ranges in timer validation
status: completed
type: bug
priority: normal
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T09:38:19Z
parent: ps-4ioj
---

Timer validation rejects wakingStart >= wakingEnd, blocking overnight ranges like 22:00-06:00. Validation and post-merge validator both need to allow start > end as crossing midnight.
