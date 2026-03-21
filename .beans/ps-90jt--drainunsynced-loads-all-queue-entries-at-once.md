---
# ps-90jt
title: drainUnsynced loads all queue entries at once
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:00:21Z
parent: ps-i3xl
---

Add LIMIT + batch drain, sqlite-offline-queue-adapter.ts:124-127

## Summary of Changes\n\nAdded DRAIN_BATCH_SIZE (500) constant and applied LIMIT parameter to drainUnsynced SQL query to prevent unbounded memory usage from large offline queues.
