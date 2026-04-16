---
# api-4fk5
title: Migrate route tests to shared mock factories
status: completed
type: task
priority: low
created_at: 2026-03-18T11:09:06Z
updated_at: 2026-04-16T07:29:42Z
parent: ps-rdqo
---

Steps 3-5 of H-5/H-6/H-7/H-8: migrate 49 files with inline MOCK_AUTH to import from route-test-setup, 88 files to use common-route-mocks factories, and inline createApp() to createRouteApp(). Infrastructure committed in fix/api-audit-high-findings branch.

## Summary of Changes\n\nMigrated all 89 route test files to use shared mock factories from `common-route-mocks.ts` and shared helpers from `route-test-setup.ts`:\n\n- Replaced inline vi.mock bodies for audit-writer, db, rate-limit, auth, and system-ownership with factory calls\n- Replaced inline `const MOCK_AUTH` blocks with imports from route-test-setup\n- Replaced inline `createApp()` functions with `createRouteApp()`\n- Replaced inline `postJSON/putJSON/patchJSON` (standard 3-param signature) with shared helpers\n- Added `MOCK_ACCOUNT_ONLY_AUTH`, `mockAccountOnlyAuthFactory()`, and `mockSystemOwnershipFactory()` to shared helpers\n- Made `createRouteApp` generic over `Env` to support both authenticated and unauthenticated routes\n- Cleaned up unused imports (Hono, Context, AuthContext, errorHandler, requestIdMiddleware)
