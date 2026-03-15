---
# sync-t1rl
title: Sync protocol messages
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:35:44Z
updated_at: 2026-03-15T01:11:02Z
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

- [x] All message types defined with TypeScript types
- [x] Handshake flow documented step-by-step
- [x] Transport-agnostic (no WebSocket-specific assumptions)
- [x] Error message types for each failure mode
- [x] Idempotency guarantee documented
- [x] Written as specification in packages/sync/docs/

## References

- ADR 005

## Summary of Changes

Created `packages/sync/docs/protocol-messages.md` (13 sections): transport abstraction, 9 client→server and 10 server→client message type definitions, JSON serialization spec, handshake flow diagram, steady-state sync cycle, error codes with recovery strategies, idempotency guarantees per message type, reconnection protocol, transport notes, protocol version semantics, and `SyncNetworkAdapter` method mapping.

Created `packages/sync/src/protocol.ts`: full discriminated union of all 19 message types, `SyncTransport` interface, `TransportState`, `SyncErrorCode`, supporting types (`DocumentVersionEntry`, `DocumentCatchup`), `ClientMessage`/`ServerMessage`/`SyncMessage` unions, and `SYNC_PROTOCOL_VERSION = 1` constant.

Updated `packages/sync/src/index.ts` to re-export all protocol types.
