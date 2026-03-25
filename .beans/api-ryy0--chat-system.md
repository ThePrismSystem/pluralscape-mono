---
# api-ryy0
title: Chat system
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T07:45:30Z
parent: ps-53up
---

Channels, proxy messaging, rich text, @mentions

### Deletion pattern

Channels: API returns 409 HAS_DEPENDENTS if child channels or messages exist. Messages/board messages: leaf entities, always deletable. Archival always allowed regardless of dependents.

## Scope

Real-time and async messaging infrastructure for system-internal communication. Covers channel hierarchy (categories + channels), chat messages with proxy switching and @mentions, and the transport layer connecting to the existing CRDT sync engine. All message content is T1 encrypted (zero-knowledge server); only structural metadata (channelId, timestamp, replyToId, senderId) is T3 plaintext.

Depends on existing infrastructure: PG schema (`packages/db/src/schema/pg/communication.ts`), server types (`packages/types/src/encryption.ts`), CRDT schemas (`packages/sync/src/schemas/chat.ts`), branded IDs, and enums.

## Acceptance Criteria

- Channel CRUD with category/channel hierarchy, cursor pagination, archive/restore, delete (409 if has children or messages)
- Message CRUD with reply threading, edit history, cursor pagination by timestamp
- Proxy switching: messages accept senderId (member ref), validated against system membership
- @mentions: polymorphic EntityReference<"member" | "group" | "structure-entity"> extracted from T3 metadata
- Partitioned messages table queries work correctly (ADR 016)
- ChatDocument wired into sync engine document factory with subscription profiles
- Lifecycle events registered for all channel and message mutations
- Unit tests: 85%+ coverage, all branches (especially 409 delete, partition queries, mention validation)
- Integration tests: PGlite with real DB ops, RLS enforcement
- E2E tests: full CRUD lifecycle, auth, error codes, pagination, archive/restore/delete

## Design References

- `packages/db/src/schema/pg/communication.ts` — PG schema (channels, messages tables)
- `packages/sync/src/schemas/chat.ts` — CRDT ChatDocument schema
- `packages/types/src/encryption.ts` — ServerChannel, ServerMessage types
- `docs/adr/016-messages-partitioning.md` — Hash-based message partitioning
- `docs/adr/007-realtime.md` — Real-time architecture

## Summary of Changes\n\nImplemented the complete chat system API layer:\n- Channel CRUD with category/channel hierarchy, cursor pagination, 409 HAS_DEPENDENTS\n- Message CRUD with partition-aware composite (timestamp, id) cursor pagination\n- Optional timestamp query param on single-entity message endpoints for partition pruning\n- 16 route files, 2 services, 2 validation schemas, 10 audit event types, INVALID_HIERARCHY error code\n- DB migration for audit_log CHECK constraint update\n- Integration tests (PGlite) + E2E tests (12 Playwright specs)\n- Proxy switching (api-00ih) confirmed as client-side concern (senderId is T1 encrypted)\n- CRDT sync infrastructure verified (factory, subscription filter, document types all in place)
