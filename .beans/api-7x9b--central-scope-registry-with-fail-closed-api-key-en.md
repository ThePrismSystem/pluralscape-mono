---
# api-7x9b
title: Central scope registry with fail-closed API key enforcement
status: completed
type: task
priority: normal
created_at: 2026-04-07T00:01:24Z
updated_at: 2026-04-16T07:29:53Z
parent: ps-h2gl
---

Refactor per-route/per-procedure scope enforcement into a central scope registry with fail-closed behavior. If a new endpoint is added without a scope mapping, API key requests are rejected with 403 before the handler executes. Session auth is unaffected.

Follow-up from api-u998 (per-endpoint scope enforcement).

## Summary of Changes

- Created `apps/api/src/lib/scope-registry.ts` — central `SCOPE_REGISTRY` mapping 265 REST routes and 270 tRPC procedures to their required scopes
- Created `apps/api/src/middleware/scope-gate.ts` — global Hono middleware on `systemRoutes` that looks up matched route patterns in the registry, rejects unregistered API key requests with 403
- Created `apps/api/src/trpc/middlewares/scope-gate.ts` — global tRPC middleware on `errorMapProcedure` that looks up procedure paths in the registry, same fail-closed behavior
- Wired scope gates into `systemRoutes` (after auth), notification stream, and `errorMapProcedure`
- Removed `requireScopeMiddleware()` from ~50 REST route files and `requireScope()` from ~30 tRPC router files
- Deleted `apps/api/src/middleware/scope.ts` and `apps/api/src/trpc/middlewares/scope.ts`
- Created `scripts/check-scope-coverage.ts` CI script validating registry completeness
- Added `pnpm scope:check` to package.json and `.husky/pre-push` hook
- Updated all scope-related unit and integration tests
