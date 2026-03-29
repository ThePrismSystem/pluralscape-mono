---
# api-7acx
title: "L4: Remove unused archivable() columns on webhookDeliveries"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

archivable() columns on webhookDeliveries appear unused — no service code sets/queries them.

## Summary of Changes\n\nRemoved archivable() from webhookDeliveries schema. Generated migration dropping archived/archivedAt columns.
