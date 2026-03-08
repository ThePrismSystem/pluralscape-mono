---
# types-aab2
title: WebSocket and SSE event types
status: todo
type: task
priority: normal
created_at: 2026-03-08T18:49:51Z
updated_at: 2026-03-08T19:32:27Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Types for real-time event delivery via WebSocket and SSE.

## Scope

`WebSocketEvent` is a discriminated union on `type`:

- `FrontingUpdateEvent`: type 'fronting-update', systemId, sessionId (FrontingSessionId), action ('started' | 'ended')
- `MessageReceivedEvent`: type 'message-received', channelId (ChannelId), messageId (MessageId)
- `MemberUpdatedEvent`: type 'member-updated', memberId (MemberId), fields (string[])
- `SystemSettingsChangedEvent`: type 'system-settings-changed', systemId
- `SyncStateChangedEvent`: type 'sync-state-changed', systemId, pendingChanges (number)
- `PresenceUpdateEvent`: type 'presence-update', systemId, deviceCount (number)

All variants share: id (string), timestamp (UnixMillis)

- `SSEEvent`: { id, type, data } — server-sent event fallback
- `RealtimeSubscription`: channelId (string | null), eventTypes (WebSocketEventType[]), filters
- `WebSocketConnectionState`: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
- All payloads T3-only (no encrypted content in events)

## Acceptance Criteria

- [ ] WebSocketEvent as discriminated union (6 types)
- [ ] SSEEvent fallback format
- [ ] RealtimeSubscription with event type filtering
- [ ] WebSocketConnectionState for UI
- [ ] Unit tests for event type narrowing

## References

- ADR 007 (Real-time)
- features.md section 15 (Offline-First and Sync)
