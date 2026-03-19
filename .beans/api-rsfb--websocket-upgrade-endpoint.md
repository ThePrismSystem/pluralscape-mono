---
# api-rsfb
title: WebSocket upgrade endpoint
status: todo
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T11:39:40Z
parent: api-fh4u
---

Implement `GET /v1/sync/ws` using Hono's `upgradeWebSocket`. Auth validation before upgrade (401 rejection). Binary-framed JSON transport.

## Acceptance Criteria

- WebSocket upgrade succeeds for valid session token
- Invalid/missing token returns 401 before upgrade completes
- Correct Content-Type negotiation
- Binary-framed JSON transport established on successful upgrade
- Unit tests for auth validation and upgrade flow
