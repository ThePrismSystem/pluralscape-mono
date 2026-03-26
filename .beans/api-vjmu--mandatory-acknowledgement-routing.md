---
# api-vjmu
title: Mandatory acknowledgement routing
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-26T05:04:21Z
parent: ps-53up
---

Targeted persistent alerts, cooperative enforcement

## Scope

Mandatory acknowledgement requests that persist until a specific member confirms. Cooperative enforcement (not cryptographic). T1 encrypted content (message, targetMemberId, confirmedAt); T3 plaintext (createdByMemberId, confirmed). Already modeled in ChatDocument CRDT as LWW map with confirmed/confirmedAt fields.

Note: acknowledgements are cooperative guardrails within a system, not cryptographically enforced. Members share one account — the app facilitates trust-based internal coordination, not identity verification.

## Acceptance Criteria

- Acknowledgement CRUD: create (with target member, message), confirm, list (filter pending/confirmed), archive, delete
- Confirm sets confirmed=true idempotently
- Pending endpoint: list unconfirmed for requesting member
- CRDT sync via ChatDocument.acknowledgements map (LWW for confirmed/confirmedAt)
- Lifecycle events: created, confirmed, archived, deleted
- Unit tests: 85%+ coverage, confirm idempotency, pending filter
- Integration tests: PGlite with real DB ops
- E2E tests: create, confirm, list pending, archive/delete

## Design References

- `packages/db/src/schema/pg/communication.ts` — acknowledgements table
- `packages/sync/src/schemas/chat.ts` — CrdtAcknowledgementRequest
- `packages/types/src/encryption.ts` — ServerAcknowledgementRequest type

## Summary of Changes\n\nFull acknowledgement routing implemented: validation schemas, CRUD service (create, confirm idempotent, get, list with confirmed/pending filter, archive, restore, delete), 8 API route files registered at /:systemId/acknowledgements, audit event types, CRDT sync verified, E2E tests. DB schema updated with timestamps()/versioned() for pattern consistency.
