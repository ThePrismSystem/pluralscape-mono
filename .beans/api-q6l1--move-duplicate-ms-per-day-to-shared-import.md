---
# api-q6l1
title: Move duplicate MS_PER_DAY to shared import
status: scrapped
type: task
priority: low
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-04-16T06:29:46Z
parent: ps-4ioj
---

webhook-delivery-cleanup.ts declares local MS_PER_DAY duplicating the constant already exported from @pluralscape/types.
