---
# db-4pir
title: RLS-helper lint rule + unset-context integration test
status: todo
type: task
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T13:58:21Z
parent: ps-0vwf
---

Prevent RLS fail-silent regressions by (a) forbidding bare db.execute / db.transaction outside lib/rls-context.ts helpers via a lint rule, and (b) adding an integration test that asserts a query without setTenantContext throws rather than silently returning [].

## Context

RLS policies use NULLIF(current_setting('app.current_system_id', true), '')::varchar. Forgetting to call withTenantRead or withTenantTransaction produces an empty GUC, which makes the policy evaluate to false for every row — queries silently return nothing instead of failing loud. The wrapper helpers exist; nothing enforces their use.

## Scope

- [ ] Write an ESLint rule (in tooling/eslint-config) forbidding direct imports or calls of db.execute / db.transaction outside apps/api/src/lib/rls-context.ts and apps/api/src/lib/cross-account-\*.ts
- [ ] Add integration test in packages/db/src/**tests**: acquire a raw postgres connection (no context), run SELECT on any RLS-protected table, assert that either the query throws (preferred — add a BEFORE INSERT trigger that checks the GUC is set, OR rely on a documented RLS behavior that fails rather than returning empty) OR that the query returns 0 rows and a separate runtime-assertion in the wrapper helpers confirms the error before the query reaches the DB
- [ ] If the trigger approach is taken, add the trigger via a new migration file
- [ ] Document the lint rule in CLAUDE.md

## Out of scope

- Refactoring the wrapper helpers themselves (they already exist and work)

## Acceptance

- pnpm lint flags any new code introducing bare db.execute outside allowed files
- pnpm vitest run --project db-integration includes the unset-context test and it passes

## Notes

The trigger approach is the strongest defense but requires agreement that it's an acceptable perf cost on every write. Start with the lint rule (cheap); add the trigger only if the team wants runtime enforcement in addition.
