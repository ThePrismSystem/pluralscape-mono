---
# sync-kpb2
title: Apply typed errors to sync-engine.ts
status: completed
type: task
priority: low
created_at: 2026-03-21T00:34:19Z
updated_at: 2026-03-21T11:14:30Z
parent: api-0zl4
blocked_by:
  - ps-38gq
---

M13 follow-up: replace throw new Error('No active session') on sync-engine.ts:221 with NoActiveSessionError. Requires WT5 and WT7 both merged.

## Summary of Changes\n\nAdded `NoActiveSessionError` typed error class with `docId` field to `packages/sync/src/errors.ts`. Replaced generic `throw new Error()` in sync-engine.ts with the typed error. Exported from package index. Updated tests to assert specific error type.
