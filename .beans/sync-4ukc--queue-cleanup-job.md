---
# sync-4ukc
title: Queue cleanup job
status: completed
type: task
priority: low
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:24:43Z
parent: sync-hji0
---

Delete sync_queue rows where syncedAt IS NOT NULL and older than retention window.

## Acceptance Criteria

- Only deletes rows with non-null syncedAt (confirmed synced)
- Does not delete unsynced rows (syncedAt = null) regardless of age
- Retention window configurable in constants file
- Runs as background job on schedule
- Unit tests: mixed queue with synced/unsynced rows, verify correct deletion

## Summary of Changes

Implemented as part of feat/sync-conflict-resolution-and-offline-queue branch.
