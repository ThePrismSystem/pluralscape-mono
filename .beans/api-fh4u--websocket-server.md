---
# api-fh4u
title: WebSocket server
status: todo
type: epic
priority: critical
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-19T11:39:40Z
parent: ps-afy4
blocking:
  - sync-qxxo
  - api-n8wk
  - crypto-og5h
---

Live fronting updates, chat messages

## Scope

WebSocket server infrastructure for real-time bidirectional communication. Implements the transport layer defined in `packages/sync/docs/protocol-messages.md`: upgrade endpoint, session authentication, connection lifecycle, protocol message routing, Valkey pub/sub fan-out, and subscription management.

This is the **critical path** for M3 — sync, SSE, and device transfer all depend on WebSocket infrastructure.

## Acceptance Criteria

- WebSocket upgrade endpoint at `GET /v1/sync/ws` with pre-upgrade auth validation
- Full protocol message lifecycle: authenticate → subscribe → push/pull → unsubscribe → close
- Connection manager tracks active connections by (accountId, sessionId) with graceful cleanup
- Valkey pub/sub enables cross-instance push delivery
- All 9 client message types from the protocol spec are routed and handled
- E2E tests cover auth, protocol mismatch rejection, and subscribe → push flow

## Design References

- `packages/sync/docs/protocol-messages.md` — Wire protocol, all message types
- `packages/sync/docs/partial-replication.md` — Subscription profiles
- `docs/adr/007-realtime.md` — Real-time architecture decision
