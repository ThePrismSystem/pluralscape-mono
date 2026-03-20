---
# sync-4aqa
title: Offline queue persistence
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:24:43Z
parent: sync-hji0
---

Persist encrypted change envelopes to sync_queue when transport is disconnected (syncedAt = null).

## Acceptance Criteria

- Changes accumulate in sync_queue with syncedAt = null when transport offline
- Queue survives app restart (persisted to SQLite)
- Changes ordered by seq per system
- Queue operations are atomic (no partial writes)
- Unit tests: enqueue while offline, verify persistence across simulated restart

## Summary of Changes

Implemented as part of feat/sync-conflict-resolution-and-offline-queue branch.
