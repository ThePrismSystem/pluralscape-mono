---
# sync-2raa
title: Conflict record persistence
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:24:43Z
parent: sync-p1uq
---

Write resolved and auto-resolved conflicts to \`sync_conflicts\` table with SyncResolution value.

## Acceptance Criteria

- Concurrent edits that trigger a normalizer produce a conflict record
- resolvedAt populated for auto-resolved conflicts
- Tombstone conflicts recorded with appropriate resolution type
- Conflict records queryable by document ID and time range
- Integration test: concurrent edit → verify conflict row written with correct SyncResolution

## Summary of Changes

Implemented as part of feat/sync-conflict-resolution-and-offline-queue branch.
