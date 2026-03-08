---
# db-771z
title: RLS and dialect-specific features
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:33:24Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-s6p9
  - db-9f6f
  - db-i2gl
---

Row-level security (PostgreSQL) and dialect feature detection.

## Scope

- PostgreSQL RLS policies: every query scoped to system_id via row-level security
- RLS policy: `USING (system_id = current_setting('app.current_system_id'))` on all multi-tenant tables
- Note: member_photos now has a direct system_id FK for RLS (not just member_id → members → system_id)
- SQLite: application-level tenant isolation (query builder always includes WHERE system_id = ?)
- Feature detection utility: `isPostgreSQL()` / `isSQLite()` based on dialect config
- Document dialect capability matrix (JSONB ops, RLS, arrays, enums — PG only)
- pgcrypto extension usage for defense-in-depth encryption at rest

## Acceptance Criteria

- [ ] RLS policies defined for all tables with system_id
- [ ] member_photos has direct system_id for RLS policy
- [ ] RLS policies tested on PostgreSQL
- [ ] SQLite isolation enforced via query builder wrappers
- [ ] Feature detection utility exported
- [ ] Dialect capability matrix documented
- [ ] Integration test: verify RLS prevents cross-tenant access (PG only)

## References

- ADR 004 (PostgreSQL RLS)
