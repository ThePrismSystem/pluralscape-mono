---
# ps-6hyr
title: "types-ltel C11a: brandedId lift for 6 remaining tables"
status: todo
type: task
priority: high
created_at: 2026-04-24T09:26:42Z
updated_at: 2026-04-24T09:26:42Z
parent: types-ltel
---

First of three sub-PRs closing out the types-ltel epic (C11).

## Scope

Lift 6 remaining PG schema files to `brandedId<B>()` for all ID / FK columns:

- [ ] `packages/db/src/schema/pg/analytics.ts`
- [ ] `packages/db/src/schema/pg/audit-log.ts`
- [ ] `packages/db/src/schema/pg/biometric-tokens.ts`
- [ ] `packages/db/src/schema/pg/pk-bridge.ts`
- [ ] `packages/db/src/schema/pg/safe-mode-content.ts`
- [ ] `packages/db/src/schema/pg/search.ts`
- [ ] Sqlite siblings where present
- [ ] Wrap fixture ID literals in affected integration tests with `brandId<XId>()`
- [ ] Verify `pnpm typecheck` + `pnpm test:integration` green

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
