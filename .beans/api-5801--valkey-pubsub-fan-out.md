---
# api-5801
title: Valkey pub/sub fan-out
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T14:37:40Z
parent: api-fh4u
---

Publish to \`sync:{docId}\` channel on ChangeAccepted. Subscribers on any server instance receive DocumentUpdate push via Valkey pub/sub.

## Acceptance Criteria

- ChangeAccepted triggers publish to \`sync:{docId}\` Valkey channel
- Subscribers on same instance receive DocumentUpdate push
- Subscribers on different server instance receive DocumentUpdate push (multi-instance)
- Valkey unavailable → graceful degradation (log warning, local delivery still works)
- Integration tests with Valkey for pub/sub roundtrip

## Summary of Changes

Implemented Valkey pub/sub adapter for cross-instance WebSocket fan-out:

- Created `ValkeyPubSub` class with dual ioredis connections (subscriber + publisher)
- Auto-resubscribes to all active channels on reconnect (Valkey drops subscriptions)
- Graceful degradation: all methods are no-ops when Valkey is unavailable
- Injectable factory for testability (dynamic import in production, mock in tests)
- Exposed `serverId` for deduplication of self-published messages
- 17 unit tests covering connect, publish, subscribe, unsubscribe, reconnection, disconnect
