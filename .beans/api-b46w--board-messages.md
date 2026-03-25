---
# api-b46w
title: Board messages
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T05:59:18Z
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
