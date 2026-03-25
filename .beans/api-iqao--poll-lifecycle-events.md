---
# api-iqao
title: Poll lifecycle events
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T23:51:08Z
parent: api-8lt2
blocked_by:
  - api-6m3p
  - api-5cnc
---

Register poll.created/updated/closed/archived/deleted and poll-vote.cast/vetoed event types. Tests: unit (event type validation) + integration (lifecycle event persistence).

## Summary of Changes\n\nAll 8 poll audit event types verified in existing service integration tests. No additional wiring needed.
