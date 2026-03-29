---
# api-2yua
title: Add RLS context to findPendingDeliveries query
status: completed
type: bug
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T12:48:11Z
parent: api-kjyg
---

webhook-delivery-worker.ts:231-250 runs on raw db handle without withTenantRead, deviating from established pattern. While this is an internal worker function, a bug could cause cross-tenant access.
