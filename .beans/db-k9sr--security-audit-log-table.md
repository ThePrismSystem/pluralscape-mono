---
# db-k9sr
title: Security audit log table
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:03:43Z
updated_at: 2026-03-10T02:56:32Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Append-only security audit log table for tracking authentication events and sensitive operations.

## Scope

### Tables

- **`audit_log`**: id (UUID PK, NOT NULL), account_id (FK → accounts, ON DELETE SET NULL — logs survive deletion for compliance), system_id (FK → systems, ON DELETE SET NULL, nullable — for system-scoped events), event_type (varchar, T3, NOT NULL), timestamp (T3, NOT NULL), ip_address (varchar, T3, nullable), user_agent (varchar, T3, nullable), actor (T3, NOT NULL — structured: { kind: 'account'|'system'|'api-key', id: UUID }), detail (T3, NOT NULL — event-specific details as JSONB/JSON)
  - actor and detail types: JSONB on PostgreSQL, TEXT-as-JSON on SQLite (via Drizzle customType)
- All fields T3 (server-visible) — audit logs are for security monitoring
- Append-only: no UPDATE or DELETE; enforced via application layer

### Event types

login-success, login-failed, session-created, session-revoked, password-changed, recovery-key-used, api-key-created, api-key-revoked, data-export, account-purge-requested, device-added, device-removed, bucket-key-rotated

### Indexes

- audit_log (account_id, timestamp)
- audit_log (system_id, timestamp) — for system-scoped queries
- audit_log (event_type)

### Retention

Configurable per deployment (default 90 days hosted, unlimited self-hosted)

## Acceptance Criteria

- [x] audit_log table with all event types supported
- [x] system_id column (nullable, ON DELETE SET NULL)
- [x] actor as structured JSONB (kind: 'account'|'system'|'api-key', id)
- [x] detail (renamed from metadata) as JSONB (PG) / TEXT-as-JSON (SQLite) via Drizzle customType
- [x] Append-only pattern enforced in application
- [x] IP address and user agent captured
- [x] Indexes on (account_id, timestamp) and event_type
- [x] Migrations for both dialects
- [x] Integration test: insert audit entries and query by account

## References

- features.md section 14 (Security audit log)

## Summary of Changes

Implemented `audit_log` table (PG + SQLite) with all 20 event types via CHECK constraint, JSONB actor (DbAuditActor), ON DELETE SET NULL for both FKs, AUDIT_EVENT_TYPES enum. Used built-in jsonb() for PG (pgJsonb double-parses with PGlite). 8 integration tests.
