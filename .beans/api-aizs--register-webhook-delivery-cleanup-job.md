---
# api-aizs
title: Register webhook delivery cleanup job
status: completed
type: task
priority: normal
created_at: 2026-03-29T02:08:02Z
updated_at: 2026-03-29T07:00:32Z
parent: api-9wze
blocked_by:
  - api-p4th
---

Wrap existing cleanupWebhookDeliveries() in a BullMQ job handler on a daily cron schedule (30-day retention).

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes\n\nImplemented in PR #312: webhook delivery cleanup wrapped in BullMQ job on daily cron (30-day retention).
