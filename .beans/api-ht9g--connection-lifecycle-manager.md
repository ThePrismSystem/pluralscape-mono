---
# api-ht9g
title: Connection lifecycle manager
status: todo
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T11:39:40Z
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
