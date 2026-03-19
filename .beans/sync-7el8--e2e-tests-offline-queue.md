---
# sync-7el8
title: "E2E tests: offline queue"
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-hji0
---

End-to-end tests for offline queue and replay.

## Acceptance Criteria

- Tests live in \`apps/api-e2e/src/tests/sync/\`
- Test: Submit changes while disconnected, reconnect, verify changes arrive at relay
- Test: Multiple offline sessions accumulate, all replay on reconnect
- Test: Connection drop during replay → resumes correctly on next reconnect
- All tests use real WebSocket connections
