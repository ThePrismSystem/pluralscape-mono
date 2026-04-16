---
# api-7yk0
title: Batch webhook delivery cleanup deletes
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-16T06:29:44Z
parent: ps-4ioj
---

cleanupWebhookDeliveries deletes all terminal deliveries >30 days in a single DELETE RETURNING. Add batched deletion (1000 rows per chunk).
