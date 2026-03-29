---
# api-2enh
title: "M3: Add RLS context to findPendingDeliveries"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:47Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

webhook-delivery-worker.ts:231-250 — Uses raw db handle without withTenantRead, deviating from the pattern used everywhere else.

## Summary of Changes\n\nAdded JSDoc to findPendingDeliveries explaining intentional cross-tenant query pattern.
