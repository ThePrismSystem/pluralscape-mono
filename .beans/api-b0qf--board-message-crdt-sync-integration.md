---
# api-b0qf
title: Board message CRDT sync integration
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T11:31:32Z
parent: api-b46w
blocked_by:
  - api-pcak
---

Already part of ChatDocument (boardMessages map). Verify wiring into sync engine. Tests: unit (merge behavior for sortOrder/pinned LWW fields).

## Summary of Changes

CRDT sync integration verified — existing tests already cover board message wiring:

- `packages/sync/src/__tests__/crdt-strategies.test.ts` verifies board-message strategy (append-lww, topology correction documented)
- `packages/sync/src/__tests__/schemas.test.ts` verifies ChatDocument.boardMessages field
- Strategy config at `packages/sync/src/strategies/crdt-strategies.ts` (lines 246-252) is correct: storageType=append-lww, document=chat, fieldName=boardMessages
- CrdtBoardMessage type at `packages/sync/src/schemas/chat.ts` (lines 53-63) has all expected fields with pinned/sortOrder as LWW-mutable

No new code needed — existing coverage is sufficient.
