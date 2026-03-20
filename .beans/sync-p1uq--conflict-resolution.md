---
# sync-p1uq
title: Conflict resolution
status: completed
type: epic
priority: high
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-20T18:17:08Z
parent: ps-afy4
blocked_by:
  - sync-qxxo
---

CRDT merge semantics for concurrent edits, application-level rules for relational conflicts like orphaned entities

## Scope

Post-merge validation engine that runs after Automerge applies changes. Handles hierarchy cycle detection, sort order normalization, check-in record normalization, friend connection normalization, tombstone enforcement, and conflict record persistence.

Blocked by sync-qxxo (CRDT sync) — conflict resolution runs inside the sync engine's apply path.

## Acceptance Criteria

- PostMergeValidator runs all normalizers after Automerge.applyChanges
- Cycle detection triggers CycleBreak resolution
- Sort order ties resolved deterministically
- All 14 existing conflict resolution tests continue to pass
- Resolved/auto-resolved conflicts written to sync_conflicts table
- Tombstone (archived) flag wins over concurrent edits
- E2E tests validate two-client convergence and tombstone propagation

## Design References

- `packages/sync/docs/conflict-resolution.md` — Full conflict resolution spec
- `packages/sync/src/__tests__/conflict-resolution.test.ts` — Existing 14 tests

## Summary of Changes

All 4 children completed: conflict record persistence, post-merge validation engine, tombstone enforcement, and E2E tests. Delivered in feat/sync-conflict-resolution-and-offline-queue PR.
