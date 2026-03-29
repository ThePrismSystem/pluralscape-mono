---
# api-mth5
title: Remove unused archivable columns from webhookDeliveries
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

Both PG and SQLite schemas apply archivable() to webhookDeliveries adding archived/archivedAt columns. No service code sets, queries, or filters on these. Delivery lifecycle is pending->success/failed->cleanup(delete). ArchivedWebhookDelivery type is also unused. Requires migration.
