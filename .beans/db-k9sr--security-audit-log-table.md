---
# db-k9sr
title: Security audit log table
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:43Z
updated_at: 2026-03-08T14:03:43Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Append-only security audit log table

## Scope

- `audit_log`: id, account_id (FK), event_type (varchar — T3), timestamp (T3), ip_address (varchar nullable — T3), user_agent (varchar nullable — T3), metadata (JSON — T3, event-specific details)
- All fields T3 (server-visible) — audit logs are for security monitoring, not user content
- Append-only: no UPDATE or DELETE operations (enforce via application layer; PostgreSQL rule/trigger optional)
- Event types: login-success, login-failed, session-created, session-revoked, password-changed, recovery-key-used, api-key-created, api-key-revoked, data-export, account-purge-requested, device-added, device-removed
- Indexes: audit_log (account_id, timestamp), audit_log (event_type)
- Retention: configurable per deployment (default 90 days hosted, unlimited self-hosted)

## Acceptance Criteria

- [ ] audit_log table with all event types supported
- [ ] Append-only pattern enforced in application
- [ ] IP address and user agent captured
- [ ] JSON metadata for event-specific details
- [ ] Indexes on (account_id, timestamp) and event_type
- [ ] Migrations for both dialects
- [ ] Integration test: insert audit entries and query by account

## References

- features.md section 14 (Security audit log)
