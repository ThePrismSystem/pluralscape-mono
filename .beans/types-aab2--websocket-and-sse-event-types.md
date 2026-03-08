---
# types-aab2
title: WebSocket and SSE event types
status: todo
type: task
created_at: 2026-03-08T18:49:51Z
updated_at: 2026-03-08T18:49:51Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Types for real-time event delivery: WebSocketEvent as discriminated union (fronting-update, message-received, member-updated, system-settings-changed, sync-state-changed, presence-update). SSEEvent for server-sent events fallback. RealtimeSubscription (channelId, eventTypes, filters). Per ADR 007.
