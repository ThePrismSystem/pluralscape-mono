---
# api-8dfg
title: Add webhook delivery worker unit tests
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T10:36:29Z
parent: ps-4ioj
---

processWebhookDelivery and findPendingDeliveries have zero unit test coverage. Only utility functions (computeWebhookSignature, calculateBackoffMs) are tested.

## Summary of Changes\n\nExtended `apps/api/src/__tests__/services/webhook-delivery-worker.test.ts` with 13 new unit tests using mockDb:\n- 11 tests for `processWebhookDelivery`: delivery not found, config not found, config disabled, correct fetch call, correct headers, success marking, retry scheduling, max retries exceeded, TypeError handling, AbortError handling, unexpected error rethrowing\n- 2 tests for `findPendingDeliveries`: limit passthrough, result forwarding
