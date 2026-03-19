---
# api-bvtm
title: Protocol message router
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T14:12:36Z
parent: api-fh4u
---

Dispatch `ClientMessage` types to handler functions. Schema validation using Zod (MALFORMED_MESSAGE on failure). Route all 9 client message types defined in protocol spec.

## Acceptance Criteria

- Unknown message type → MALFORMED_MESSAGE error response
- Schema validation failure → MALFORMED_MESSAGE with detail
- Each of the 9 known client message types dispatches to correct handler
- Handler dispatch is exhaustive (compile-time enforcement via switch + never default)
- Unit tests for routing each message type and malformed input

## Summary of Changes

Implemented WebSocket protocol message router with state machine dispatch:

- Created Zod schemas for all 9 client message types with Base64url transform
- Created serialization utilities (base64urlToBytes, bytesToBase64url)
- Created state-machine message router with awaiting-auth/authenticated/closing phases
- Created handlers for all message types: manifest (stub), fetch, submit, subscribe, document-load
- Singleton EncryptedRelay (in-memory, Phase 1) as storage backend
- Per-connection rate limiting (mutation 100/10s, read 200/10s)
- Exhaustive switch with compile-time enforcement for all 9 message types
- 27 tests across schema validation and router dispatch
