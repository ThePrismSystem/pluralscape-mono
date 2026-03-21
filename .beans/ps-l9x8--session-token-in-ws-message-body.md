---
# ps-l9x8
title: Session token in WS message body
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T07:55:18Z
parent: ps-i3xl
---

Mitigated by TLS, document the tradeoff

## Summary of Changes\n\nAdded inline comment to auth-handler.ts explaining that the session token is sent in the WS message body because browser WebSocket API does not support custom headers, mitigated by requiring wss:// in production.
