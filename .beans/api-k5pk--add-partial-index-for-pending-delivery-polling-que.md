---
# api-k5pk
title: Add partial index for pending delivery polling query
status: completed
type: task
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T07:39:45Z
parent: api-kjyg
---

findPendingDeliveries in webhook-delivery-worker.ts:232-250 uses OR (nextRetryAt IS NULL, nextRetryAt <= now()) which doesn't efficiently use existing indexes. Add a dedicated partial index WHERE status = 'pending' on (next_retry_at) or restructure with COALESCE and matching expression index.

## Summary of Changes

Added partial index webhook_deliveries_pending_retry_idx on (next_retry_at) WHERE status = 'pending' to optimize the findPendingDeliveries polling query. Added to both PG and SQLite schemas.
