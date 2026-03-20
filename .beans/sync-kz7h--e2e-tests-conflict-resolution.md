---
# sync-kz7h
title: "E2E tests: conflict resolution"
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:24:43Z
parent: sync-p1uq
---

End-to-end tests for conflict resolution across two clients.

## Acceptance Criteria

- Tests live in \`apps/api-e2e/src/tests/sync/\`
- Test: Two-client concurrent edit on same field → deterministic convergence
- Test: Tombstone propagation — archive on one client, edit on other, verify archive wins
- Test: Hierarchy cycle created by concurrent moves → cycle broken
- All tests use real WebSocket connections and sync engine

## Summary of Changes

Implemented as part of feat/sync-conflict-resolution-and-offline-queue branch.
