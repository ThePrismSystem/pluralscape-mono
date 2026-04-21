---
# api-e3li
title: Replace as-never queue mock with typed vi.mocked() double
status: todo
type: task
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T13:58:21Z
parent: ps-0vwf
---

Replace the as-never JobQueue mock in apps/api/src/**tests**/services/switch-alert-dispatcher.integration.test.ts:56-77 with a typed vi.mocked() double. Restores type safety on queue operations.

## Context

switch-alert-dispatcher.integration.test.ts:56-77 uses createMockQueue that returns objects typed as `never`, allowing any method signature to compile. This bypasses the type system for the entire queue surface in this test.

## Scope

- [ ] Define JobQueueMock type that mirrors JobQueue from packages/queue
- [ ] Replace createMockQueue() with a helper that returns a Partial<JobQueue> typed via vi.mocked
- [ ] Update all call sites in the test file to use the new typed mock
- [ ] Remove the `as never` cast
- [ ] Verify the test still exercises the same code paths

## Out of scope

- Other queue mocks (search for similar patterns in other test files; handle only if trivial)

## Acceptance

- No `as never` in apps/api/src/**tests**/services/switch-alert-dispatcher.integration.test.ts
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
