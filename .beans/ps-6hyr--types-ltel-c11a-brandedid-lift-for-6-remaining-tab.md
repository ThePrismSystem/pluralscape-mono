---
# ps-6hyr
title: "types-ltel C11a: brandedId lift for 6 remaining tables"
status: completed
type: task
priority: high
created_at: 2026-04-24T09:26:42Z
updated_at: 2026-04-24T10:59:31Z
parent: types-ltel
---

First of three sub-PRs closing out the types-ltel epic (C11).

## Scope

Lift 6 remaining PG schema files to `brandedId<B>()` for all ID / FK columns:

- [x] `packages/db/src/schema/pg/analytics.ts`
- [x] `packages/db/src/schema/pg/audit-log.ts`
- [x] `packages/db/src/schema/pg/biometric-tokens.ts`
- [x] `packages/db/src/schema/pg/pk-bridge.ts`
- [x] `packages/db/src/schema/pg/safe-mode-content.ts`
- [x] ~~`packages/db/src/schema/pg/search.ts`~~ (N/A — raw SQL DDL, not a pgTable)
- [x] Sqlite siblings where present
- [x] Wrap fixture ID literals in affected integration tests with `brandId<XId>()`
- [x] Verify `pnpm typecheck` + `pnpm test:integration` green

Parity tests for these 6 tables STAY on `StripBrands<>` — tightening happens in C11c.

## Out of scope

- Tightening any parity tests (that's C11c)
- Timestamp changes (that's C11b)

## Acceptance

- `pnpm typecheck` green
- `pnpm test:integration` green
- No changes to any `*.type.test.ts` or `__helpers__.ts`
- Six schema files now use `brandedId<B>()` for ID and FK columns

## Spec

docs/superpowers/specs/2026-04-24-types-ltel-c11-cleanup-design.md

## Summary of Changes

Lifted 5 Drizzle schema files (PG + sqlite) to `brandedId<B>()` for all ID and FK columns: audit-log (AuditLogEntryId/AccountId/SystemId), analytics/frontingReports (FrontingReportId/SystemId), biometric-tokens (BiometricTokenId/SessionId), pk-bridge (PKBridgeConfigId/SystemId), safe-mode-content (SafeModeContentId/SystemId). Added `SafeModeContentId` brand + `smc_` prefix in packages/types/src/ids.ts (also exported from package barrel). Fixture literals wrapped with `brandId<XId>()` in 8 integration test files. Cross-package boundary wraps in `apps/api/src/lib/audit-log.ts`, `apps/api/src/services/audit-log-query.service.ts`, `apps/api/src/services/fronting-report/create.ts`, `apps/api/src/services/fronting-report/queries.ts`. `packages/types/src/__tests__/ids.test.ts` count assertion bumped 64→65 for the new prefix.

`packages/db/src/schema/pg/search.ts` re-scoped out — it contains raw SQL DDL, not a Drizzle pgTable, so brandedId does not apply.

Parity tests for these 5 tables remain on `StripBrands<>` — tightening happens in C11c.
