---
# db-k9sr
title: Security audit log table
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:43Z
updated_at: 2026-03-08T19:32:27Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Append-only security audit log table for tracking authentication events and sensitive operations.

## Scope

### Tables

- **`audit_log`**: id (UUID PK, NOT NULL), account_id (FK → accounts, ON DELETE SET NULL — logs survive deletion for compliance), event_type (varchar, T3, NOT NULL), timestamp (T3, NOT NULL), ip_address (varchar, T3, nullable), user_agent (varchar, T3, nullable), metadata (T3, NOT NULL — event-specific details)
  - metadata type: JSONB on PostgreSQL, TEXT-as-JSON on SQLite (via Drizzle customType)
- All fields T3 (server-visible) — audit logs are for security monitoring
- Append-only: no UPDATE or DELETE; enforced via application layer

### Event types

login-success, login-failed, session-created, session-revoked, password-changed, recovery-key-used, api-key-created, api-key-revoked, data-export, account-purge-requested, device-added, device-removed, bucket-key-rotated

### Indexes

- audit_log (account_id, timestamp)
- audit_log (event_type)

### Retention

Configurable per deployment (default 90 days hosted, unlimited self-hosted)

## Acceptance Criteria

- [ ] audit_log table with all event types supported
- [ ] metadata as JSONB (PG) / TEXT-as-JSON (SQLite) via Drizzle customType
- [ ] Append-only pattern enforced in application
- [ ] IP address and user agent captured
- [ ] Indexes on (account_id, timestamp) and event_type
- [ ] Migrations for both dialects
- [ ] Integration test: insert audit entries and query by account

## References

- features.md section 14 (Security audit log)
