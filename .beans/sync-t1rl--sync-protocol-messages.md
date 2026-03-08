---
# sync-t1rl
title: Sync protocol messages
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:35:44Z
updated_at: 2026-03-08T13:35:50Z
parent: sync-xlhb
---

Design document: sync protocol message types and handshake specification. Output is a specification with TypeScript type definitions, not a full implementation.

## Scope

- Message types: SyncRequest, SyncResponse, DocumentUpdate, Acknowledgement, Error
- Handshake flow:
  1. Client authenticates with session token
  2. Client sends document list with versions
  3. Server responds with missing updates
  4. Bidirectional delta exchange
  5. Acknowledgement with cryptographic confirmation
- Transport-agnostic design (works over WebSocket, HTTP polling, direct peer)
- Message framing: length-prefixed binary or JSON envelope
- Error handling: malformed messages, version mismatch, auth failure
- Idempotency: replaying messages must be safe

## Acceptance Criteria

- [ ] All message types defined with TypeScript types
- [ ] Handshake flow documented step-by-step
- [ ] Transport-agnostic (no WebSocket-specific assumptions)
- [ ] Error message types for each failure mode
- [ ] Idempotency guarantee documented
- [ ] Written as specification in packages/sync/docs/

## References

- ADR 005
