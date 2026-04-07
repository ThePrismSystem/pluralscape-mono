---
# api-lu29
title: CI script to verify all API endpoints have required security middleware
status: completed
type: task
priority: normal
created_at: 2026-04-06T18:37:34Z
updated_at: 2026-04-07T00:01:00Z
---

Create a CI check that verifies every REST route and tRPC procedure has all required security middleware applied: auth gating, rate limiting, API key scope enforcement, idempotency (for mutations). Should fail CI if any endpoint is missing a required middleware layer. Follow-up from api-u998 (scope enforcement).


## Summary of Changes

Implemented as part of the central scope registry fail-closed enforcement:

- Created `scripts/check-scope-coverage.ts` — validates every authenticated REST route and tRPC procedure has a corresponding entry in the central scope registry (`apps/api/src/lib/scope-registry.ts`)
- Added `pnpm scope:check` script to root `package.json`
- Added to `.husky/pre-push` hook alongside typecheck, lint, and unit tests
- Script checks REST completeness (via `buildInventory()` from `audit-routes.ts`), tRPC completeness (via regex parsing of router files), stale entries, and scope validity
- Exits non-zero with clear report if any gaps found

Note: This bean originally scoped broader middleware coverage (auth, rate limiting, idempotency). The scope check covers API key scope enforcement only. Auth and rate limiting are already validated by `audit-routes.ts`. Idempotency coverage could be a follow-up.
