---
# api-5xl6
title: Wire Valkey pub/sub for cross-instance sync broadcast
status: completed
type: task
priority: high
created_at: 2026-03-30T06:58:13Z
updated_at: 2026-03-30T08:04:02Z
parent: api-e7gt
---

ValkeyPubSub class exists in apps/api/src/ws/valkey-pubsub.ts but broadcastDocumentUpdate() only does local delivery (comment: 'Local delivery only in Phase 1'). Wire Valkey pub/sub into the broadcast path so multi-instance deployments can fan out sync updates across instances.

## Summary of Changes

Wired Valkey pub/sub into the WebSocket broadcast path. Added `broadcastDocumentUpdateWithSync()` that performs local delivery then publishes to Valkey channel `ps:sync:<docId>` with serverId for dedup. ValkeyPubSub connects at startup when VALKEY_URL is set and disconnects during shutdown. Graceful degradation: if Valkey is unavailable, logs warning and continues local-only (pubsub is nullable throughout). Added `SyncBroadcastPubSub` interface for testability.
