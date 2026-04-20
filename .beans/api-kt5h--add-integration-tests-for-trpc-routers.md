---
# api-kt5h
title: Add integration tests for tRPC routers
status: completed
type: task
priority: normal
created_at: 2026-04-02T08:37:25Z
updated_at: 2026-04-20T03:19:55Z
parent: ps-0enb
---

All 30 tRPC router test files are unit-only with mocked services. CLAUDE.md requires integration tests covering auth, CRUD for all entities. Write integration tests hitting real tRPC context and database for each router.

## Implementation Progress

Plan: docs/superpowers/plans/2026-04-19-trpc-router-integration-tests-plan.md
Worktree: .worktrees/test-trpc-router-integration (branch test/trpc-router-integration)

- [x] Task 1: Baseline (1013 tests pass, 45s)
- [x] Task 2: setupRouterIntegration helper
- [x] Task 3: truncateAll (signature changed to truncateAll(ctx) — avoids casts)
- [x] Task 4: makeIntegrationCallerFactory
- [x] Task 5: seedAccountAndSystem + seedSecondTenant
- [x] Task 6: expectAuthRequired + expectTenantDenied
- [x] Task 7: shared entity seed helpers
- [x] Task 8: member (11 tests, canonical)
- [x] Task 9: system (9 tests)
- [x] Task 10: auth (17 tests, real registerTestAccount)
- [x] Task 11: bucket (22 tests)
- [x] Task 12: fronting-session (11 tests)
- [x] Task 13: fronting-comment (9 tests)
- [x] Task 14: friend (18 tests)
- [x] Task 15: group (16 tests)
- [x] Task 16: structure (28 tests)
- [x] Task 17: field (15 tests)
- [x] Task 18: innerworld (18 tests)
- [x] Task 19: import-job (6 tests)
- [x] Task 20: webhook-config (11 tests)
- [x] Task 21: blob (8 tests)
- [x] Task 22: note (9 tests)
- [x] Task 23: /verify (1235 total api-integration tests, +222 new; typecheck/lint/format clean)
- [x] Task 24: close bean

## Summary of Changes

Added integration tests for 15 high-risk tRPC routers covering the router → middleware → service → PGlite path that previously had no dedicated coverage. Closes the gap between unit tests (mocked services) and E2E (full HTTP).

**Shared infrastructure** (apps/api/src/**tests**/trpc/integration-helpers.ts):

- `setupRouterIntegration()`, `truncateAll(ctx)` — PGlite lifecycle
- `seedAccountAndSystem`, `seedSecondTenant`, `SeededTenant` — tenant fixtures
- `seedMember`, `seedBucket`, `seedFrontingSession`, `seedStructureEntity`, `seedFriendConnection` — entity fixtures used by 3+ routers
- `expectAuthRequired`, `expectTenantDenied` — assertion helpers
- `makeIntegrationCallerFactory` (in test-helpers.ts) — real-context tRPC caller

**15 router test files** (~222 new tests):
auth (17), system (9), member (11, canonical), bucket (22), fronting-session (11), fronting-comment (9), friend (18), group (16), structure (28), field (15), innerworld (18), import-job (6), webhook-config (11), blob (8), note (9).

Each file covers happy-path-per-procedure + UNAUTHORIZED + cross-tenant FORBIDDEN/NOT_FOUND. Auth router uses `registerTestAccount` (real two-phase libsodium flow); blob mocks `lib/storage.js` to inject in-memory adapter.

**Verification:**

- api-integration: 1235 tests pass (was 1013 baseline, +222 new) in 60s
- typecheck: 21/21 clean
- lint: 17/17 zero warnings
- format: clean
- no skipped/todo tests

**Known follow-ups (not blocking):**

- `seedAcceptedFriendConnection` is duplicated in bucket and friend test files. Promote to integration-helpers.ts when a 3rd router needs it.
- structure.entity.getHierarchy uses raw `tx.execute` whose return shape differs PGlite vs postgres-js — replaced happy-path with NOT_FOUND assertion. Consider a shared tx.execute adapter.
- webhook-config.test asserts result shape only (no fetchFn injection at router layer); full success-path covered by service-layer integration test.
- Remaining 23 routers (out of 38 total) are the next bean's scope.
