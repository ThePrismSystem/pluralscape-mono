---
# api-czvk
title: Delete stale friend-code vi.mock block in account/pin.test.ts
status: completed
type: task
priority: normal
created_at: 2026-04-22T02:42:42Z
updated_at: 2026-04-22T03:32:03Z
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

## Summary of Changes

Deleted the four `vi.mock()` blocks for `services/account/friend-codes/{generate,list,redeem,archive}.js` from `apps/api/src/__tests__/routes/account/pin.test.ts`.

pin.test.ts never imports friend-code services directly; they were only loaded transitively via `accountRoutes`. Removing the mocks lets the real verb-file bodies enter the module graph without executing them (no top-level side effects). The pin.test.ts suite continues to pass.
