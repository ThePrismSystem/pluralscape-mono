---
# db-5bu5
title: Split rls-policies.integration.test.ts (2,470 LOC) by table group
status: todo
type: task
priority: normal
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-30T05:00:05Z
parent: ps-36rg
---

Split packages/db/src/**tests**/rls-policies.integration.test.ts (2,470 LOC) into multiple files organized by RLS scope type.

## Context

The RLS migration covers 70 tables with five distinct scoping patterns: account isolation, system isolation, dual (account+system), PK with account check (systems table), NULL-aware dual (audit_log), and asymmetric read/write (key_grants). Each pattern has its own test category in the monolithic file.

## Scope

- [ ] Split into rls-account-isolation.integration.test.ts, rls-system-isolation.integration.test.ts, rls-dual-tenant.integration.test.ts, rls-systems-pk.integration.test.ts, rls-audit-log.integration.test.ts, rls-key-grants.integration.test.ts
- [ ] Extract shared setup into packages/db/src/**tests**/helpers/rls-test-helpers.ts
- [ ] Each resulting file ≤500 LOC (stretch 350)
- [ ] Every existing test case preserved — count before and after match

## Out of scope

- Changing any RLS policy
- Related DB tests (schema integration, query tests)

## Acceptance

- pnpm vitest run --project db-integration passes
- Coverage unchanged or higher
- Original file deleted

## DRY pass

While extracting helpers, scan sibling integration tests in packages/db for the same RLS-context boilerplate and consolidate when clear. Don't refactor any RLS policy. Per 2026-04-29 re-scope spec.
