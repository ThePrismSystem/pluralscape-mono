---
# api-m5ic
title: Session authentication over WebSocket
status: todo
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T11:39:40Z
parent: api-fh4u
---

Process `AuthenticateRequest` as first message after WebSocket connection. Reuse session validation logic from REST middleware. Return `AuthenticateResponse`.

## Acceptance Criteria

- Valid token → authenticated, connection promoted to active state
- Expired token → AUTH_EXPIRED error code, connection closed
- Protocol version mismatch → PROTOCOL_MISMATCH error code, connection closed
- No message within auth timeout → connection closed
- Unit tests for each auth outcome
