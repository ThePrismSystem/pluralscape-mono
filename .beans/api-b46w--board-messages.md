---
# api-b46w
title: Board messages
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T11:35:28Z
parent: ps-53up
---

CRUD, ordering, persistence

## Scope

Persistent noticeboard messages that are immune to chat scroll. Supports drag-and-drop reorder (batch sortOrder updates), pin/unpin, and standard CRUD. Board messages are leaf entities (always deletable, no 409). Content is T1 encrypted; pinned, sortOrder are T3 plaintext. Already part of ChatDocument CRDT schema as append-lww map.

## Acceptance Criteria

- Board message CRUD with sortOrder-based listing, pin/unpin, batch reorder
- Leaf entity deletion (no dependent checks)
- Archive/restore lifecycle
- CRDT sync via existing ChatDocument.boardMessages map (LWW for pinned/sortOrder)
- Lifecycle events for all mutations including reorder
- Unit tests: 85%+ coverage, reorder logic, pin/unpin branches
- Integration tests: PGlite with real DB ops
- E2E tests: full CRUD, reorder, pin/unpin, archive/restore/delete

## Design References

- `packages/db/src/schema/pg/communication.ts` — board_messages table
- `packages/sync/src/schemas/chat.ts` — CrdtBoardMessage (append-lww)
- `packages/types/src/encryption.ts` — ServerBoardMessage type

## Summary of Changes

All 6 child tasks completed:

- **api-7oey**: Validation schemas (4 Zod schemas, 29 unit tests)
- **api-lmdm**: Audit event types (6 board-message events registered)
- **api-pcak**: CRUD service (10 functions, 31 integration tests)
- **api-sfms**: API routes (11 route files, 11 route unit tests)
- **api-b0qf**: CRDT sync verified (existing tests sufficient)
- **api-amlf**: E2E tests (lifecycle + error scenarios)

Board messages are served at `/v1/systems/:systemId/board-messages` with full CRUD, pin/unpin, batch reorder, archive/restore, and delete. Leaf entity deletion (no dependent checks). OCC for updates. ALREADY_PINNED/NOT_PINNED error codes added.
