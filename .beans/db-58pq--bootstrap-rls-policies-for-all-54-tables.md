---
# db-58pq
title: Bootstrap RLS policies for all 54 tables
status: completed
type: task
priority: critical
created_at: 2026-03-13T13:20:58Z
updated_at: 2026-04-16T07:29:37Z
parent: db-2nr7
---

Generate applyAllRls() that iterates RLS_TABLE_POLICIES and applies generateRlsStatements() per table. Create CLI script, static migration, test helpers, and integration tests verifying all tables have policies in pg_policies.

## Summary of Changes

- Created `packages/db/src/rls/apply.ts` with `applyAllRls(executor)` that iterates all RLS_TABLE_POLICIES and applies DROP+CREATE for idempotent policy management
- Created CLI script `packages/db/scripts/apply-rls.ts` for manual RLS application via DATABASE_URL
- Added `db:apply-rls` script to `packages/db/package.json`
- Generated static migration `0009_rls_all_tables.sql` covering all tables
- Added `createPgAllTables` and `applyAllRlsToClient` helpers to test infrastructure
- Created integration test verifying all tables have policies, FORCE is enabled, and idempotency works
- Re-exported `applyAllRls` and `RlsExecutor` from package index
