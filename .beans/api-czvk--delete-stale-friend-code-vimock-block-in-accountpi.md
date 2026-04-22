---
# api-czvk
title: Delete stale friend-code vi.mock block in account/pin.test.ts
status: todo
type: task
created_at: 2026-04-22T02:42:42Z
updated_at: 2026-04-22T02:42:42Z
parent: api-6l1q
---

Flagged by api-z33q during the api-6l1q refactor.

## Problem

`apps/api/src/__tests__/routes/account/pin.test.ts:49` — the vi.mock for friend-code mocks non-existent exports (`createFriendCode`, `revokeFriendCode`). The mock was repointed to the new per-verb paths during api-z33q, but the consumer (pin.test.ts) doesn't actually import anything from friend-code. The mock block is dead code.

## Scope

- Delete the vi.mock('../../../services/account/friend-codes/...') block entirely from pin.test.ts
- Verify pin.test.ts still passes

## Acceptance

- Dead mock removed
- Test continues to pass
