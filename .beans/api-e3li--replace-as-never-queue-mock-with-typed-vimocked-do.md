---
# api-e3li
title: Replace as-never queue mock with typed vi.mocked() double
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T14:30:46Z
parent: ps-0vwf
---

Replace the as-never JobQueue mock in apps/api/src/**tests**/services/switch-alert-dispatcher.integration.test.ts:56-77 with a typed vi.mocked() double. Restores type safety on queue operations.

## Context

switch-alert-dispatcher.integration.test.ts:56-77 uses createMockQueue that returns objects typed as `never`, allowing any method signature to compile. This bypasses the type system for the entire queue surface in this test.

## Scope

- [x] Define JobQueueMock type that mirrors JobQueue from packages/queue
- [x] Replace createMockQueue() with a helper that returns a Partial<JobQueue> typed via vi.mocked
- [x] Update all call sites in the test file to use the new typed mock
- [x] Remove the `as never` cast
- [x] Verify the test still exercises the same code paths

## Out of scope

- Other queue mocks (search for similar patterns in other test files; handle only if trivial)

## Acceptance

- No `as never` in apps/api/src/**tests**/services/switch-alert-dispatcher.integration.test.ts
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes

## Summary of Changes

- Replaced `as never`-returning `createMockQueue()` in `switch-alert-dispatcher.integration.test.ts` with a `JobQueue`-typed mock. Untested methods throw via `notImplemented(name)` stubs so any new dispatcher call surfaces immediately.
- `JobDefinition` and `JobId` imports merged into the existing `@pluralscape/types` type import block to satisfy import ordering lint.
- No sibling `as never` queue mocks found in other test files (`account-notifications.test.ts` already uses a typed `FakeQueue extends JobQueue` pattern).
- pnpm typecheck: pass. pnpm vitest --project api-integration (this file): 18/18 pass.
