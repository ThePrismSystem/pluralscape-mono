---
# api-7oey
title: Board message validation schemas
status: completed
type: task
priority: critical
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T11:19:21Z
parent: api-b46w
---

packages/validation/src/board-message.ts — Create/Update/Reorder/Archive/Delete schemas. Reorder schema: array of { id, sortOrder } pairs. Tests: unit tests for all schemas.

## Summary of Changes

Created `packages/validation/src/board-message.ts` with four Zod schemas:

- `CreateBoardMessageBodySchema` (encryptedData, sortOrder, pinned)
- `UpdateBoardMessageBodySchema` (encryptedData, version, optional sortOrder/pinned)
- `ReorderBoardMessagesBodySchema` (operations array with boardMessageId + sortOrder)
- `BoardMessageQuerySchema` (includeArchived, pinned filter)

Unit tests in `packages/validation/src/__tests__/board-message.test.ts` (29 tests).
Exported from `packages/validation/src/index.ts`.
