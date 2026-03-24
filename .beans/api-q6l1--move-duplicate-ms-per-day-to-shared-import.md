---
# api-q6l1
title: Move duplicate MS_PER_DAY to shared import
status: todo
type: task
priority: low
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-03-24T09:25:32Z
parent: ps-4ioj
---

webhook-delivery-cleanup.ts declares local MS_PER_DAY duplicating the constant already exported from @pluralscape/types.
