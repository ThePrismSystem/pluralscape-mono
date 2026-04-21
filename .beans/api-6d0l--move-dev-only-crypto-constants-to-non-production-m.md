---
# api-6d0l
title: Move dev-only crypto constants to non-production module
status: todo
type: task
created_at: 2026-04-21T13:59:06Z
updated_at: 2026-04-21T13:59:06Z
parent: ps-0vwf
---

Move ANTI_ENUM_SALT_SECRET_DEFAULT and DEV_HMAC_KEY to a dev-only module that cannot be statically imported by production bundles. Defense-in-depth on top of the existing Zod refine guards in env.ts.

## Context

apps/api/src/routes/auth/auth.constants.ts:30 exports ANTI_ENUM_SALT_SECRET_DEFAULT; apps/api/src/services/api-key.service.ts:50 defines DEV_HMAC_KEY inline. Both are already prevented from being runtime-active in production via Zod refinements in apps/api/src/env.ts that reject missing env vars and the dev-default string value in NODE_ENV=production. The residual risk is that the dev-default string literal still ships inside the production bundle, where a future bug could plausibly surface it.

## Scope

- [ ] Create apps/api/src/lib/dev-constants.ts exporting ANTI_ENUM_SALT_SECRET_DEFAULT and DEV_HMAC_KEY
- [ ] Refactor env.ts and dependent modules to conditionally import from dev-constants.ts only when NODE_ENV !== "production" (dynamic import inside a conditional, or tree-shake-friendly pattern that Vitest/Bun can drop)
- [ ] Verify via a build-output inspection (e.g. grep the bundle) that the literal string "pluralscape-dev-anti-enum-secret-do-not-use-in-prod" is absent from a production bundle
- [ ] Preserve the Zod refinement runtime guards — this change is additive
- [ ] Update apps/api/src/**tests**/env.test.ts (or equivalent) to verify the dev-constants import path still works in test mode

## Out of scope

- Changes to the Zod env schema logic
- Other dev-only helpers

## Acceptance

- pnpm typecheck passes
- pnpm vitest run --project api passes
- Dev-default string absent from a production bundle (manual verification step in the acceptance section of the PR)
