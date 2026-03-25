---
# api-amlf
title: "E2E tests: board messages"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T11:32:40Z
parent: api-b46w
blocked_by:
  - api-sfms
---

apps/api-e2e/src/tests/chat/board-messages.spec.ts — CRUD lifecycle, reorder, pin/unpin, archive/restore/delete. Cover: auth, error responses, response shapes.

## Summary of Changes

Created `apps/api-e2e/src/tests/chat/board-messages.spec.ts` with:

- Full lifecycle test: create, get, list, update, pin/unpin, archive/restore, delete (12 steps)
- Reorder test: create two, swap sortOrders, verify
- Pinned filter test
- Error scenarios: wrong version (409), already archived (409), restore non-archived (409), reorder non-existent (404), pin already pinned (409), unpin non-pinned (409)
