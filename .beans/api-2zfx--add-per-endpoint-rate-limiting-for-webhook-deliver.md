---
# api-2zfx
title: Add per-endpoint rate limiting for webhook delivery
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

webhook-delivery-worker.ts processes each delivery independently with no throttling per target URL. Many events to a single endpoint fire concurrent requests, risking overwhelming the receiver. Implement per-URL concurrency or rate limiting (token bucket per hostname or BullMQ rate limiter config).
