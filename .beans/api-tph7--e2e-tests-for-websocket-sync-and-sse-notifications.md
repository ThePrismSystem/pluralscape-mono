---
# api-tph7
title: E2E tests for WebSocket sync and SSE notifications
status: completed
type: task
created_at: 2026-03-21T03:06:40Z
updated_at: 2026-03-21T03:06:40Z
parent: ps-irrf
---

Implements finding T-H3 from the M3 comprehensive audit: minimal E2E vertical
slice for WebSocket sync and SSE notifications.

## Summary of Changes

### New files

- `apps/api-e2e/src/fixtures/ws-sync.fixture.ts` — higher-level WS sync fixture
  with `createAuthenticatedWsClient()` factory, `makeTestChange()` builder,
  base64url helpers, and wire-format constants. Re-exports `SyncWsClient`.
- `apps/api-e2e/src/tests/websocket/ws-sync-vertical.spec.ts` — full lifecycle
  vertical slice test: connect, authenticate, subscribe, submit change, verify
  subscriber receives DocumentUpdate, and clean disconnect. Also tests
  unsubscribe stops updates, catchup on reconnect, and clean disconnect
  isolation.
- `apps/api-e2e/src/tests/notifications/sse-stream.spec.ts` — SSE notification
  stream E2E tests: connection with auth, 401 rejection, content-type and
  Cache-Control headers, heartbeat receipt, Last-Event-ID reconnect semantics
  (full-sync event on stale ID, graceful handling of ID 0), and multiple
  concurrent connections.
