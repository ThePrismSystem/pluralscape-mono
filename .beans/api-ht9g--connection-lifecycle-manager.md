---
# api-ht9g
title: Connection lifecycle manager
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T13:47:24Z
parent: api-fh4u
---

Track active WebSocket connections by (accountId, sessionId). Handle graceful close and abnormal disconnect. Per-connection state: authenticated systemId, profile type, subscribed doc set, last seq per doc.

## Acceptance Criteria

- Active connections tracked in server-local map keyed by (accountId, sessionId)
- Graceful close: unsubscribe all docs, remove from map, release resources
- Abnormal disconnect: same cleanup triggered by error/timeout detection
- Multi-tab allowed (multiple connections per account)
- No memory leak on disconnect (verify with test that connects/disconnects N times)
- Connection state exposes: systemId, profile type, subscribed docs, last seq per doc

## Summary of Changes

Implemented ConnectionManager class with dual-index tracking:

- Created `SyncConnectionState` interface with connection phase state machine
- Created `ConnectionManager` with primary map + accountId and docId secondary indexes
- Tracks unauthenticated connection count for Slowloris prevention
- Supports per-account connection counting for limit enforcement
- Clears auth timeouts on removal to prevent timer leaks
- Refactored `ws/index.ts` to use ConnectionManager instead of minimal map
- 25 unit tests covering register/remove, auth, subscriptions, multi-tab, closeAll
