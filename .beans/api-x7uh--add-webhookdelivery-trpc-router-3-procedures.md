---
# api-x7uh
title: Add webhookDelivery tRPC router (3 procedures)
status: completed
type: feature
priority: normal
created_at: 2026-04-02T09:47:03Z
updated_at: 2026-04-16T07:29:51Z
parent: api-7xw0
---

Create webhookDeliveryRouter with 3 procedures matching REST /webhook-deliveries/\* endpoints. Uses systemProcedure. Procedures: list, get, delete. See audit Domain 15.

## Summary of Changes\n\nAdded webhookDeliveryRouter with 3 procedures to apps/api/src/trpc/routers/webhook-delivery.ts
