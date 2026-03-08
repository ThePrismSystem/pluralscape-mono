---
# types-j2h3
title: Security audit log types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:33Z
updated_at: 2026-03-08T14:22:19Z
parent: types-im7i
blocked_by:
  - types-av6x
---

AuditLogEntry type for security audit log

## Scope

- `AuditLogEntry`: id, accountId, eventType (AuditEventType), timestamp (UnixMillis), ipAddress (string | null), userAgent (string | null), metadata (record)
- `AuditEventType`: 'login-success' | 'login-failed' | 'session-created' | 'session-revoked' | 'password-changed' | 'recovery-key-used' | 'api-key-created' | 'api-key-revoked' | 'data-export' | 'account-purge-requested' | 'device-added' | 'device-removed'
- All entries are T3 (server-visible plaintext) — needed for security monitoring
- Append-only: no UPDATE or DELETE operations
- Retention policy: configurable per deployment (default 90 days for hosted, unlimited for self-hosted)

## Acceptance Criteria

- [ ] AuditLogEntry type with all event types
- [ ] All 12 audit event types defined
- [ ] IP address and user agent captured
- [ ] Metadata field for event-specific details
- [ ] Append-only semantics enforced at type level (no update operations)
- [ ] Unit tests for entry creation helpers

## References

- features.md section 14 (Security audit log)

## Audit Findings (002)

- Should use `Plaintext<T>` wrapper from types-ae5n instead of plain types (all T3 but should be explicit)
