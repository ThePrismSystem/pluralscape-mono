---
# api-aizs
title: Register webhook delivery cleanup job
status: todo
type: task
priority: normal
created_at: 2026-03-29T02:08:02Z
updated_at: 2026-03-29T02:08:23Z
parent: api-9wze
blocked_by:
  - api-p4th
---

Wrap existing cleanupWebhookDeliveries() in a BullMQ job handler on a daily cron schedule (30-day retention).
