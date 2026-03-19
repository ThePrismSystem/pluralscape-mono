---
# api-gzpt
title: "E2E tests: WebSocket server"
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: api-fh4u
---

End-to-end tests for WebSocket server infrastructure.

## Acceptance Criteria

- Tests live in \`apps/api-e2e/src/tests/websocket/\`
- Test: WS upgrade with valid auth succeeds
- Test: WS upgrade with invalid auth returns 401
- Test: Protocol version mismatch rejection
- Test: Subscribe → receive push when another client submits a change
- Test: Graceful close cleans up subscriptions
- All tests use real WebSocket connections against running API server
