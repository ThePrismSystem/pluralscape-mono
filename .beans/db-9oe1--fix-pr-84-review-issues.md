---
# db-9oe1
title: "Fix PR #84 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-13T14:37:32Z
updated_at: 2026-03-13T14:46:24Z
---

Fix account-pk/system-pk bugs, extract dropPolicySql, add transaction wrapping, new integration tests, lint config

## Summary of Changes

- Fixed account-pk bug: `accountRlsPolicy('accounts', 'id')` now uses `tableName` parameter
- Fixed system-pk: replaced if/else with config map (`SYSTEM_PK_ID_COLUMN`)
- Added `ACCOUNT_PK_ID_COLUMN` config map for account-pk symmetry
- Extracted `dropPolicySql()` helper as single source of truth for CREATE_POLICY_RE regex
- Exported `dropPolicySql` from barrel (rls/index.ts and src/index.ts)
- Updated apply.ts: transaction wrapping (BEGIN/COMMIT/ROLLBACK), fixed JSDoc, uses shared `dropPolicySql`
- Updated generate-rls-migration.ts to use shared `dropPolicySql`
- Fixed ESLint config: removed scripts/\*\* from ignores, added scripts to tsconfig include
- Added RlsExecutor type annotation to pg-helpers.ts
- Added 3 new integration test suites: dual scope, join-system scope, join-system-chained scope (15 new tests)
- Added migration sync guard test and partial-failure atomicity test
- Renamed test: 'policy count matches expected table count' -> 'exactly one policy per RLS-protected table'
