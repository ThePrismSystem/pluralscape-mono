---
# db-5bu5
title: Split rls-policies.integration.test.ts (2,470 LOC) by table group
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-30T07:37:33Z
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

## Summary of Changes

Split rls-policies.integration.test.ts (2,473 LOC) into 7 focused files plus a shared helper:

- rls-policy-generation.integration.test.ts — pure SQL generation unit tests (no PGlite)
- rls-system-isolation.integration.test.ts — members, nomenclature_settings, bucket_rotation_items
- rls-system-fk.integration.test.ts — sync_changes/snapshots/conflicts via FK join
- rls-account-isolation.integration.test.ts — auth_keys, accounts (pk), biometric_tokens (fk), friend_connections (bidirectional)
- rls-dual-tenant.integration.test.ts — api_keys, import_jobs, import_entity_refs
- rls-systems-pk.integration.test.ts — systems table (PK + account ownership guard)
- rls-audit-log.integration.test.ts — audit_log NULL-aware dual scope
- rls-key-grants.integration.test.ts — asymmetric owner/friend read, write restricted to issuer
- helpers/rls-test-helpers.ts — shared session GUC helpers, schema DDL builders, APP_ROLE constant

Test count: 87 → 96. All files ≤500 LOC. Full db-integration suite: 1595/1595 passing.
