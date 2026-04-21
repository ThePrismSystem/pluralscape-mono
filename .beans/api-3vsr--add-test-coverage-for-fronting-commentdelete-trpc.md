---
# api-3vsr
title: Add test coverage for fronting-comment.delete tRPC procedure
status: todo
type: task
priority: normal
created_at: 2026-04-21T21:56:12Z
updated_at: 2026-04-21T21:56:12Z
parent: api-6l1q
---

## Context

During api-6l1q api-u12f (fronting-comment refactor), found that `apps/api/src/__tests__/trpc/routers/fronting-comment.test.ts` omitted `deleteFrontingComment` from its vi.mock block despite the router exporting/using the delete procedure. No test in that file exercises `caller.frontingComment.delete`.

This was preserved during the refactor (lifecycle mock still omits deleteFrontingComment) to stay true to the code-motion constraint, but it is a genuine test-coverage gap.

## Scope
- [ ] Add `deleteFrontingComment: vi.fn()` to the lifecycle mock block in `__tests__/trpc/routers/fronting-comment.test.ts`
- [ ] Add at least one test covering the `frontingComment.delete` tRPC procedure:
  - Happy path: delete returns success for owned comment
  - Error path: delete returns NOT_FOUND for non-existent comment
  - Error path: delete returns FORBIDDEN for cross-tenant access (or relies on tenant scope)
- [ ] Verify the integration test (`fronting-comment.integration.test.ts`) also covers delete, or add there

## Acceptance
- `frontingComment.delete` has at least one passing unit test
- Integration test exercises delete at least once
- Coverage report shows the delete path covered
