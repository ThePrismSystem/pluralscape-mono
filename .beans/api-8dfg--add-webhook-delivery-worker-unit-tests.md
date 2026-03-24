---
# api-8dfg
title: Add webhook delivery worker unit tests
status: todo
type: task
priority: normal
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T09:24:08Z
parent: ps-4ioj
---

processWebhookDelivery and findPendingDeliveries have zero unit test coverage. Only utility functions (computeWebhookSignature, calculateBackoffMs) are tested.
