---
# api-rsfb
title: WebSocket upgrade endpoint
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T13:36:15Z
parent: api-fh4u
---

Implement `GET /v1/sync/ws` using Hono's `upgradeWebSocket`. Auth validation before upgrade (401 rejection). Binary-framed JSON transport.

## Acceptance Criteria

- WebSocket upgrade succeeds for valid session token
- Invalid/missing token returns 401 before upgrade completes
- Correct Content-Type negotiation
- Binary-framed JSON transport established on successful upgrade
- Unit tests for auth validation and upgrade flow

## Summary of Changes

Implemented the WebSocket upgrade endpoint at `GET /v1/sync/ws`:

- Created `apps/api/src/ws/` module with Hono sub-app, constants, and Bun adapter isolation
- Mounted WS route before global middleware to avoid header mutation conflicts (CORS/secureHeaders)
- Wired `websocket` handler into `Bun.serve()` with 5 MB max payload, 60s idle timeout, auto-ping
- Added Origin validation for CSWSH prevention, auth timeout (10s), and connection registry
- Added WebSocket cleanup to `shutdown()` for graceful server shutdown
- Mocked Bun adapter in affected tests (shutdown, v1-routing) to maintain test compatibility
