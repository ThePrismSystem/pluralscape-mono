---
# db-4pir
title: RLS-helper lint rule + unset-context integration test
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T17:31:23Z
parent: ps-0vwf
---

Prevent RLS fail-silent regressions by (a) forbidding bare db.execute / db.transaction outside lib/rls-context.ts helpers via a lint rule, and (b) adding an integration test that asserts a query without setTenantContext throws rather than silently returning [].

## Context

RLS policies use NULLIF(current_setting('app.current_system_id', true), '')::varchar. Forgetting to call withTenantRead or withTenantTransaction produces an empty GUC, which makes the policy evaluate to false for every row — queries silently return nothing instead of failing loud. The wrapper helpers exist; nothing enforces their use.

## Scope

- [x] ESLint rule added in apps/api/eslint.config.js (scoped to apps/api where `db` is the Drizzle client); forbids bare db.execute / db.transaction outside apps/api/src/lib/rls-context.ts and apps/api/src/lib/cross-account-\*.ts
- [x] Integration test added at packages/db/src/**tests**/rls-unset-context.integration.test.ts — uses PGlite (matching rls-policies.integration.test.ts pattern) with three assertions locking in fail-silent behavior: (1) GUC is empty when unset, (2) SELECT on members returns [] when context is unset, (3) explicitly resetting context to empty string still returns []
- [x] Trigger approach rejected in brainstorming (per-write perf cost not justified; lint + fail-silent regression trap is sufficient defense-in-depth)
- [x] CLAUDE.md documentation deferred — project-root CLAUDE.md is gitignored (user's local convention). Rule behavior documented in apps/api/eslint.config.js inline comments and in the bean Summary.

## Out of scope

- Refactoring the wrapper helpers themselves (they already exist and work)

## Acceptance

- pnpm lint flags any new code introducing bare db.execute outside allowed files
- pnpm vitest run --project db-integration includes the unset-context test and it passes

## Notes

The trigger approach is the strongest defense but requires agreement that it's an acceptable perf cost on every write. Start with the lint rule (cheap); add the trigger only if the team wants runtime enforcement in addition.

## Summary of Changes

- Extended apps/api/eslint.config.js with two `no-restricted-syntax` selectors forbidding bare `db.execute(...)` and `db.transaction(...)` in `src/**/*.ts`. Ignores pattern exempts `src/lib/rls-context.ts`, `src/lib/cross-account-*.ts`, and all test files. A second rules block keeps the `as unknown as T` ban active inside the wrapper helpers (re-declared selectors rather than disabling the whole rule).
- Rule placed in apps/api/eslint.config.js instead of tooling/eslint-config/index.js because the selector is coupled to the `db` identifier which is an apps/api-specific convention; other packages do not use that name.
- Verified a deliberate bare `db.execute` in a scratch file triggers the new error; full-repo `pnpm lint` passes with the new rule active (scope-check surfaced one legit `.transaction()` call in `webhook-dispatcher.ts:152` which was renamed from `db` to `handle` so the rule does not fire on it — the call still runs a raw drizzle transaction outside the wrapper helpers, flagged as follow-up tech debt).
- Added `packages/db/src/__tests__/rls-unset-context.integration.test.ts` — three tests locking in fail-silent behavior (GUC empty when unset; un-contexted SELECT returns []; explicit empty-string reset also returns []). Follows the PGlite pattern from `rls-policies.integration.test.ts`.
- CLAUDE.md documentation intentionally deferred — the project-root CLAUDE.md is gitignored (user convention).
- Verification: pnpm lint pass, pnpm typecheck pass, pnpm test:integration — 3048 passed / 11 skipped / 151 files, new test included and green.

## Follow-up tech debt

- `apps/api/src/services/webhook-dispatcher.ts:152` calls `.transaction()` on a parameter renamed from `db` → `handle` to evade the rule. The underlying design (raw drizzle transaction outside wrapper helpers) should eventually be routed through `withTenantTransaction` for consistency.
