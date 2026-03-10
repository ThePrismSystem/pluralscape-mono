---
# db-k6yh
title: "Fix all PR #51 review issues for RLS batch 5"
status: completed
type: task
priority: high
created_at: 2026-03-10T06:49:40Z
updated_at: 2026-03-10T07:02:32Z
---

Fix 25 review issues across 5 phases: policy infrastructure, policy map corrections, schema fixes, test fixes, and module organization

## Summary of Changes

### Phase 1: Policy Infrastructure

- Added `currentSettingSql()` helper using `NULLIF(current_setting(..., true), '')` for fail-closed behavior
- Changed `enableRls()` to return `string[]` instead of semicolon-joined string
- Merged `systemPkRlsPolicy`, `systemsTableRlsPolicy`, `accountsTableRlsPolicy` into parameterized `systemRlsPolicy(table, idColumn)` and `accountRlsPolicy(table, idColumn)`
- Made `RLS_TABLE_POLICIES` use `as const satisfies Record<string, RlsScopeType>` for type narrowing; exported `RlsTableName` type

### Phase 2: Policy Map Corrections

- Added `"dual"` and `"join-system"` scope types with corresponding generators
- Added `dualTenantRlsPolicy` for api_keys/audit_log (both account_id + system_id)
- Added `joinSystemRlsPolicy` with EXISTS subquery for key_grants, bucket_content_tags, friend_bucket_assignments, field_bucket_visibility
- Exhaustive switch with `never` default in `generateRlsStatements`

### Phase 3: Schema Fixes

- Added `CHECK (max_votes_per_member >= 1)` to polls table (PG + SQLite)
- Added self-referencing FK on `messages.replyToId` with ON DELETE SET NULL
- Added FK on `journalEntries.frontingSessionId` referencing `fronting_sessions(id)`
- Added missing indexes: messages(reply_to_id), acknowledgements(target_member_id), journal_entries(fronting_session_id)
- Updated DDL helpers to match schema changes

### Phase 4: Test Fixes

- Added account-scope, account-pk, and system-pk integration tests
- Added true fail-closed test (empty string context returns 0 rows)
- Added cross-tenant UPDATE/DELETE tests verifying 0 rows affected
- Session test now captures SQL content and verifies correct GUC variable names
- SQLite isolation test uses structural assertions

### Phase 5: Module Organization

- Exported `PgExecutor` type from barrel
- Combined `setTenantContext` into single `SELECT` (1 round-trip)
- Moved `ENABLE_PGCRYPTO` to `dialect.ts`, deleted `extensions.ts`
- Unexported internal policy generators from barrel
- Widened SQLite scope column type to `AnyColumn`
- Added DDL helpers documentation comments
