---
# sync-kz7h
title: "E2E tests: conflict resolution"
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-p1uq
---

End-to-end tests for conflict resolution across two clients.

## Acceptance Criteria

- Tests live in \`apps/api-e2e/src/tests/sync/\`
- Test: Two-client concurrent edit on same field → deterministic convergence
- Test: Tombstone propagation — archive on one client, edit on other, verify archive wins
- Test: Hierarchy cycle created by concurrent moves → cycle broken
- All tests use real WebSocket connections and sync engine
