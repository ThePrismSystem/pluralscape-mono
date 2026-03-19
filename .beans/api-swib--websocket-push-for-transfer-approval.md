---
# api-swib
title: WebSocket push for transfer approval
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-19T11:39:42Z
parent: crypto-og5h
---

Push notification to source device via Valkey pub/sub + WebSocket when transfer transitions to approved status.

## Acceptance Criteria

- Source device receives push notification within 1s of approval
- Notification includes transfer session ID (not key material — key material only on target)
- Works across server instances via Valkey pub/sub
- Source device not connected → notification stored for delivery on reconnect (or dropped if SSE fallback handles it)
- Integration test: complete transfer → verify source device receives notification
