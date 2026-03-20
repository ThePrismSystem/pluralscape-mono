---
# sync-la2u
title: Post-merge validation engine
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:24:43Z
parent: sync-p1uq
---

Implement \`PostMergeValidator\` that runs after Automerge.applyChanges. Executes: detectHierarchyCycles, normalizeSortOrder, normalizeCheckInRecord, normalizeFriendConnection.

## Acceptance Criteria

- PostMergeValidator integrates into sync engine apply path
- detectHierarchyCycles triggers CycleBreak resolution on detected cycles
- normalizeSortOrder resolves ties deterministically (stable sort by ID)
- normalizeCheckInRecord and normalizeFriendConnection handle their respective conflicts
- All 14 existing conflict resolution tests in \`packages/sync/src/**tests**/conflict-resolution.test.ts\` continue to pass
- New unit tests for each normalizer in isolation

## Summary of Changes

Implemented as part of feat/sync-conflict-resolution-and-offline-queue branch.
