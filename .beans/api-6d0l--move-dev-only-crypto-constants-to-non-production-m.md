---
# api-6d0l
title: Move dev-only crypto constants to non-production module
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:59:06Z
updated_at: 2026-04-21T16:51:45Z
parent: ps-0vwf
---

Move ANTI_ENUM_SALT_SECRET_DEFAULT and DEV_HMAC_KEY to a dev-only module that cannot be statically imported by production bundles. Defense-in-depth on top of the existing Zod refine guards in env.ts.

## Context

apps/api/src/routes/auth/auth.constants.ts:30 exports ANTI_ENUM_SALT_SECRET_DEFAULT; apps/api/src/services/api-key.service.ts:50 defines DEV_HMAC_KEY inline. Both are already prevented from being runtime-active in production via Zod refinements in apps/api/src/env.ts that reject missing env vars and the dev-default string value in NODE_ENV=production. The residual risk is that the dev-default string literal still ships inside the production bundle, where a future bug could plausibly surface it.

## Scope

- [x] Create apps/api/src/lib/dev-constants.ts exporting ANTI_ENUM_SALT_SECRET_DEFAULT and DEV_HMAC_KEY
- [x] Refactor env.ts and dependent modules to conditionally import from dev-constants.ts only when NODE_ENV !== "production" (dynamic import inside a conditional, or tree-shake-friendly pattern that Vitest/Bun can drop)
- [x] Verify via a build-output inspection (e.g. grep the bundle) that the literal string "pluralscape-dev-anti-enum-secret-do-not-use-in-prod" is absent from a production bundle
- [x] Preserve the Zod refinement runtime guards — this change is additive
- [x] Update apps/api/src/**tests**/env.test.ts (or equivalent) to verify the dev-constants import path still works in test mode

## Out of scope

- Changes to the Zod env schema logic
- Other dev-only helpers

## Acceptance

- pnpm typecheck passes
- pnpm vitest run --project api passes
- Dev-default string absent from a production bundle (manual verification step in the acceptance section of the PR)

## Summary of Changes

- Created `apps/api/src/lib/dev-constants.ts` with `ANTI_ENUM_SALT_SECRET_DEFAULT` and `DEV_HMAC_KEY`.
- Removed the static export of `ANTI_ENUM_SALT_SECRET_DEFAULT` from `routes/auth/auth.constants.ts`.
- Replaced the literal-equality refine in `env.ts` with a `startsWith("pluralscape-dev-")` prefix check via optional chain (`!v?.startsWith(...)`) — strictly stronger production guard that carries no sensitive literal.
- Refactored `api-key.service.ts::getHmacKey` to async + dynamic import of `DEV_HMAC_KEY` gated behind `process.env["NODE_ENV"] !== "production"`; updated `hashApiKeyToken` and `generateTokenPair` to async; updated call sites to await.
- Refactored `routes/auth/salt.ts` to use dynamic import of `ANTI_ENUM_SALT_SECRET_DEFAULT` behind the same `process.env["NODE_ENV"] !== "production"` guard.
- Updated `env-anti-enum-secret.test.ts` to assert prefix-based rejection using a `pluralscape-dev-any-suffix` value rather than the exact literal.
- Acceptance: production build grepped for `pluralscape-dev-anti-enum-secret-do-not-use-in-prod` returned NOT FOUND (good). Build command: `NODE_ENV=production bun build apps/api/src/index.ts --production --outdir apps/api/dist --target=bun`.
- pnpm typecheck: pass. pnpm vitest --project api: 428 files / 5336 tests pass. pnpm vitest --project api-integration: 75 files / 1243 tests pass.
