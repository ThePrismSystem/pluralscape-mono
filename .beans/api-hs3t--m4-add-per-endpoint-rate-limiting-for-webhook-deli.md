---
# api-hs3t
title: "M4: Add per-endpoint rate limiting for webhook delivery"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:47Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

webhook-delivery-worker.ts — No throttling per target URL. Many events to a single endpoint fire concurrent requests, risking overwhelming the receiver.

## Summary of Changes\n\nAdded per-hostname concurrency throttle (acquireHostSlot/releaseHostSlot) with WEBHOOK_PER_HOST_MAX_CONCURRENT=5.
