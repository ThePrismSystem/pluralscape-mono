---
# db-771z
title: RLS and dialect-specific features
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:33:24Z
updated_at: 2026-03-10T05:09:26Z
parent: db-2je4
blocked_by:
  - db-s6p9
  - db-9f6f
  - db-i2gl
---

Row-level security (PostgreSQL) and dialect feature detection.

## Scope

- PostgreSQL RLS policies: every query scoped to system_id via row-level security
- System-level RLS: `USING (system_id = current_setting('app.current_system_id'))` on all system-scoped tables
- Account-level RLS: `USING (account_id = current_setting('app.current_account_id'))` on: accounts, sessions, auth_keys, recovery_keys, api_keys, audit_log, device_tokens, import_jobs, export_requests, account_purge_requests
- Note: member_photos now has a direct system_id FK for RLS (not just member_id → members → system_id)
- New tables requiring RLS policies: fronting_comments, device_transfer_requests, subsystem_layer_links, subsystem_side_system_links, side_system_layer_links, friend_notification_preferences
- SQLite: application-level tenant isolation (query builder always includes WHERE system_id = ?)
- Feature detection utility: `isPostgreSQL()` / `isSQLite()` based on dialect config
- Document dialect capability matrix (JSONB ops, RLS, arrays, enums — PG only)
- pgcrypto extension usage for defense-in-depth encryption at rest

## Acceptance Criteria

- [x] RLS policies defined for all tables with system_id
- [x] member_photos has direct system_id for RLS policy
- [x] RLS policies tested on PostgreSQL
- [x] SQLite isolation enforced via query builder wrappers
- [x] Feature detection utility exported
- [x] Dialect capability matrix documented
- [x] Integration test: verify RLS prevents cross-tenant access (PG only)

## References

- ADR 004 (PostgreSQL RLS)

## Summary of Changes

Implemented RLS infrastructure and dialect detection:

- `rls/policies.ts`: SQL generators for system/account RLS policies, table policy map (38+ tables), `generateRlsStatements()` helper
- `rls/session.ts`: Transaction-scoped session variable setters (`setSystemId`, `setAccountId`, `setTenantContext`)
- `rls/sqlite-isolation.ts`: WHERE clause helpers (`systemScope`, `accountScope`) for SQLite tenant isolation
- `rls/extensions.ts`: pgcrypto extension SQL constant
- `dialect.ts`: Added `isPostgreSQL()`, `isSQLite()`, `getDialectCapabilities()` with full capability matrix
- `docs/dialect-capabilities.md`: Documented capability matrix, runtime detection, and tenant isolation patterns
- Integration tests: PGlite-based cross-tenant isolation tests with `app_user` role, SQLite scope unit tests, dialect detection tests
