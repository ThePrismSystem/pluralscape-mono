---
# ps-wiqq
title: Sequential document eviction during bootstrap
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:00:21Z
parent: ps-i3xl
---

Batch with bounded concurrency, sync-engine.ts:94-96

## Summary of Changes\n\nReplaced sequential eviction loop with mapConcurrent(subscriptionSet.evict, EVICTION_CONCURRENCY, ...) for parallel document deletion during bootstrap.
