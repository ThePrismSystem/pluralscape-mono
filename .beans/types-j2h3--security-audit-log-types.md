---
# types-j2h3
title: Security audit log types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:03:33Z
updated_at: 2026-03-09T06:05:41Z
parent: types-im7i
blocked_by:
  - types-av6x
---

AuditLogEntry type for security audit log.

## Scope

- `AuditLogEntry`: id (AuditLogEntryId), accountId (AccountId), eventType (AuditEventType), timestamp (UnixMillis), ipAddress (string | null), userAgent (string | null), metadata (Record<string, unknown>)
- `AuditEventType`: 'login-success' | 'login-failed' | 'session-created' | 'session-revoked' | 'password-changed' | 'recovery-key-used' | 'api-key-created' | 'api-key-revoked' | 'data-export' | 'account-purge-requested' | 'device-added' | 'device-removed'
- All entries are T3 (server-visible) — use `Plaintext<T>` wrapper from types-ae5n for explicit tier annotation
- Append-only: no UPDATE or DELETE operations
- Retention: configurable per deployment

## Acceptance Criteria

- [ ] AuditLogEntry uses Plaintext<T> wrapper from types-ae5n
- [ ] All 12 audit event types defined
- [ ] Append-only semantics enforced (no update type operations)
- [ ] Unit tests for entry creation helpers

## References

- features.md section 14 (Security audit log)

## Summary of Changes

Created audit-log.ts with AuditEventType (12 types), AuditLogEntry (uses Plaintext<string> for detail). Added Plaintext<T> wrapper to encryption.ts. Branch: feat/types-infrastructure.
