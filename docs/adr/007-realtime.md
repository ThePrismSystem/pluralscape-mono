# ADR 007: Real-Time — WebSockets + SSE + Valkey

## Status

Accepted

## Context

The app needs real-time capabilities for:

- Internal system chat (bidirectional, proxy-tagged messages)
- Live fronting status updates (broadcast to authorized friends)
- Push notifications when switches occur
- Mandatory acknowledgement routing (persistent alerts until a specific member confirms)

At 500K users, a single server process cannot handle all concurrent WebSocket connections — horizontal scaling requires a pub/sub backbone to fan out messages across instances.

## Decision

- **WebSockets** (via Hono's built-in helper) for bidirectional real-time: chat, live fronting updates, acknowledgement signals
- **Server-Sent Events (SSE)** for simpler one-way notification feeds (friend dashboard, status updates)
- **Valkey** as the pub/sub backbone for horizontal WebSocket scaling

### Why Valkey Over Redis

Redis changed its license in 2024 to dual RSALv2/SSPLv1 (Redis 7.4-7.x) — neither is open source or AGPL-compatible. Redis 8+ added an AGPLv3 option, but Valkey (BSD 3-Clause) is a drop-in replacement forked from the last BSD-licensed Redis by the Linux Foundation. Cleaner licensing, same protocol compatibility.

### Why Not MQTT

MQTT is not natively supported in browsers (requires MQTT-over-WebSocket bridge). Best suited for IoT, not web/mobile apps. Only reconsider if wearable device support enters scope.

## Consequences

- Hono's WebSocket support is basic — no built-in pub/sub, presence tracking, or topic routing (must implement on top of Valkey)
- Valkey is an additional service in Docker Compose for self-hosters (optional — only needed at scale or for multi-instance deployments)
- SSE has no native mobile SDK support — requires custom implementation on iOS/Android
- All real-time payloads are E2E encrypted — push notification content must not contain plaintext (send a signal, client fetches and decrypts on wakeup)

### License

Valkey: BSD 3-Clause. Compatible with AGPL-3.0.
