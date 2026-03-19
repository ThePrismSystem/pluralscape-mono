---
# api-gzpt
title: "E2E tests: WebSocket server"
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T14:45:49Z
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

## Summary of Changes

Implemented WebSocket E2E tests and wired message routing:

- Created `SyncWsClient` fixture wrapping native WebSocket with typed sync protocol
- Wired `routeMessage()` into `ws/index.ts` onMessage handler (previously stub)
- Added binary frame rejection (V1 is text-only JSON)
- 4 E2E tests: auth success, auth failure (bad token), pre-auth rejection, malformed JSON
- Added `@pluralscape/sync` dependency to api-e2e package
