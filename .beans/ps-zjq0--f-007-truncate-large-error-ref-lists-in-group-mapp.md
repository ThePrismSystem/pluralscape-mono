---
# ps-zjq0
title: "F-007: Truncate large error ref lists in group mapper"
status: todo
type: task
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-10T21:05:42Z
parent: ps-n0tq
---

group.mapper.ts:47 joins all missing member refs into one error string. 500 unresolved refs = very long message. Truncate to first N with 'and M more' suffix.
