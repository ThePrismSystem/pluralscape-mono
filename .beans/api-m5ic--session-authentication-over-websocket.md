---
# api-m5ic
title: Session authentication over WebSocket
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T13:53:48Z
parent: api-fh4u
---

Process `AuthenticateRequest` as first message after WebSocket connection. Reuse session validation logic from REST middleware. Return `AuthenticateResponse`.

## Acceptance Criteria

- Valid token → authenticated, connection promoted to active state
- Expired token → AUTH_EXPIRED error code, connection closed
- Protocol version mismatch → PROTOCOL_MISMATCH error code, connection closed
- No message within auth timeout → connection closed
- Unit tests for each auth outcome

## Summary of Changes

Implemented WebSocket session authentication handler:

- Created `auth-handler.ts` with `handleAuthenticate()` function
- Validates session token via existing `validateSession()` from session-auth.ts
- Enforces per-account connection limit (WS_MAX_CONNECTIONS_PER_ACCOUNT)
- Validates system ownership for owner profiles (skipped for friend profile)
- Clears auth timeout on success to prevent timer leak
- Protocol version enforcement delegated to Zod schema layer (Task 4)
- 8 unit tests covering valid auth, invalid/expired tokens, permission denied, rate limiting
