---
# ps-dem8
title: "Implement PR #530 review remediation"
status: completed
type: task
priority: normal
created_at: 2026-04-20T23:48:54Z
updated_at: 2026-04-21T00:02:39Z
---

Address review findings on packages/db audit-m9 RLS PR (#530).

## Todos

- [x] 1. Symmetric NULL guards in auditLogRlsPolicy WITH CHECK
- [x] 2. Scope rename for clarity (systems-pk → systems-pk-with-account, audit-log-dual → audit-log-null-aware)
- [x] 3. Replace RESET ROLE with explicit audit_reader BYPASSRLS role
- [x] 4. Tighten .rejects.toThrow() matchers at new RLS denials
- [x] 5. Add missing write-path coverage (audit_log WITH CHECK, key_grants friend UPDATE/DELETE, cross-tenant writes)
- [x] 6. Multi-system account coverage for key_grants owner_read/friend_read
- [x] 7. Defensive runtime guard on formatPartitionName
- [x] 8. Remove dynamic import in partition integration test
- [x] 9. Move parser-only test to new unit test file
- [x] 10. Extract shared schema helper in RLS integration tests
- [x] 11. Regenerate RLS migration after policy source changes
- [x] 12. Run full verification suite

## Summary of Changes

Addressed all ten items from the three-model PR #530 review.

### packages/db/src/rls/policies.ts

- auditLogRlsPolicy WITH CHECK now mirrors USING with IS NOT NULL guard (defensive against future NULL-write regressions).
- Renamed scopes: systems-pk → systems-pk-with-account, audit-log-dual → audit-log-null-aware (removes systems-pk / system-pk foot-gun).
- JSDoc updated to describe symmetry.

### packages/db/src/queries/partition-maintenance.ts

- Added runtime guards on formatPartitionName: valid PartitionedTable, year in [2000, 9999], month in [1, 12]. Belt-and-suspenders for sql.raw downstream.
- Extracted bounds as named constants.

### packages/db/migrations/pg/0001_rls_all_tables.sql

- Regenerated; sole delta is the audit_log WITH CHECK symmetry. Sync-guard test confirms no drift.

### Integration tests (rls-policies.integration.test.ts)

- New helper: createAccountsAndSystemsSchema consolidates DDL across the three audit-introduced describe blocks.
- Dedicated BYPASSRLS `audit_reader` role replaces RESET ROLE in the purge-forensics test.
- Tightened 3 .rejects.toThrow() matchers to /row-level security|new row violates/i at audit-introduced denials.
- systems UPDATE test now uses client.query (unwrapped RLS error surfaces to matcher).
- New audit_log coverage: WITH CHECK blocks cross-tenant INSERT; asymmetric NULL INSERT blocked by IS NOT NULL guard.
- New key_grants coverage: friend UPDATE/DELETE silently blocked (0-row), cross-tenant UPDATE/DELETE silently blocked, owner_read vs friend_read independently scoped across sibling systems.

### Unit tests

- rls-policies.test.ts: scope-name updates, explicit test for symmetric WITH CHECK shape.
- queries-pg-partition-maintenance.test.ts: absorbed the parser-only injection test (moved from integration file), added formatPartitionName guard tests and pg_inherits-stub simulation.
- queries-pg-partition-maintenance.integration.test.ts: removed the moved test (integration now focuses on DDL round-trip only).

### Verification

- pnpm --filter @pluralscape/db typecheck: clean
- pnpm --filter @pluralscape/db lint: clean
- pnpm vitest run --project db --project db-integration: 2119 tests pass
