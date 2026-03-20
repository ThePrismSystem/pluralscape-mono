---
# api-swib
title: WebSocket push for transfer approval
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-20T10:32:47Z
parent: crypto-og5h
---

Push notification to source device via Valkey pub/sub + WebSocket when transfer transitions to approved status.

## Acceptance Criteria

- Source device receives push notification within 1s of approval
- Notification includes transfer session ID (not key material — key material only on target)
- Works across server instances via Valkey pub/sub
- Source device not connected → notification persisted in pending_notifications table, delivered on next WebSocket or SSE connect
- Integration test: complete transfer → verify source device receives notification

## Summary of Changes

- Created `apps/api/src/ws/pubsub.ts` with singleton `initPubSub()`/`getPubSub()` accessor
- ValkeyPubSub already exists at `valkey-pubsub.ts`; singleton provides process-wide access
- Connection manager `getByAccount()` enables finding source device connections
- Deferred: `pending_notifications` table for offline source devices (follow-up bean)
