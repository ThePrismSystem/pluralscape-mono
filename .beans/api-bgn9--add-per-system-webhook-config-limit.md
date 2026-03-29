---
# api-bgn9
title: Add per-system webhook config limit
status: completed
type: task
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T07:34:21Z
parent: api-kjyg
---

createWebhookConfig has no COUNT(\*) check. A user can create unbounded configs, causing every event to fan out into N deliveries + N outbound HTTP requests. Add a configurable per-system limit. Bean api-g3xl already tracks this.

## Summary of Changes

Added MAX_WEBHOOK_CONFIGS_PER_SYSTEM = 25 constant and count check in createWebhookConfig using the same lock-then-count pattern as bucket.service.ts. Integration test verifies quota enforcement.
