---
# db-nh34
title: Implement webhook delivery cleanup
status: completed
type: task
priority: deferred
created_at: 2026-03-13T13:30:06Z
updated_at: 2026-03-21T10:18:25Z
parent: api-i8ln
blocked_by:
  - api-e127
---

Blocked on background-job infrastructure (BullMQ). Implement retention-based cleanup for webhook_deliveries table.

## Summary of Changes

- Created `apps/api/src/services/webhook-delivery-cleanup.ts` with `cleanupWebhookDeliveries()`
- Purges terminal (success/failed) delivery records older than configurable retention period (default 30 days)
- Uses the `webhook_deliveries_terminal_created_at_idx` partial index for efficient cleanup queries
- Constants defined in `service.constants.ts` (`WEBHOOK_DELIVERY_RETENTION_DAYS = 30`)
