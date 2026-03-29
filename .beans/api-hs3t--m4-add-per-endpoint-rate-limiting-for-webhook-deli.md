---
# api-hs3t
title: 'M4: Add per-endpoint rate limiting for webhook delivery'
status: todo
type: task
created_at: 2026-03-29T09:52:47Z
updated_at: 2026-03-29T09:52:47Z
parent: api-hvub
---

webhook-delivery-worker.ts — No throttling per target URL. Many events to a single endpoint fire concurrent requests, risking overwhelming the receiver.
