---
# api-n8wk
title: SSE fallback
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-19T11:40:27Z
parent: ps-afy4
blocked_by:
  - api-fh4u
---

Notifications, status updates

## Scope

Server-Sent Events (SSE) endpoint for push notifications when WebSocket is unavailable (e.g., web clients, restricted networks). Shares Valkey pub/sub infrastructure with WebSocket server. Covers endpoint, event delivery, reconnection with replay, and keep-alive heartbeat.

Blocked by api-fh4u (WebSocket server) — specifically requires Valkey pub/sub fan-out (api-5801) and connection lifecycle patterns. SSE work can begin once Valkey infrastructure is established, before the full WebSocket epic completes.

## Acceptance Criteria

- SSE endpoint at `GET /v1/notifications/stream` with session auth
- Notification events delivered via Valkey subscription (fronting status, system notification, ack signal)
- Reconnection with Last-Event-ID replays missed events within bounded window
- Keep-alive heartbeat every 30s prevents proxy timeouts
- E2E tests cover auth, event delivery, and reconnect replay

## Design References

- `docs/adr/007-realtime.md` — SSE as fallback transport
