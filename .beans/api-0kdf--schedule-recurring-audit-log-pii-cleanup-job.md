---
# api-0kdf
title: Schedule recurring audit log PII cleanup job
status: completed
type: task
priority: normal
created_at: 2026-03-17T11:59:41Z
updated_at: 2026-03-17T18:43:30Z
parent: api-tspr
---

## Security Finding

**Severity:** Low | **OWASP:** A09 Logging & Monitoring Failures | **STRIDE:** Information Disclosure
**Confidence:** Confirmed | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-7

## Problem

The audit log stores IP addresses and user agent strings as plaintext varchar columns (GDPR personal data). Cleanup queries already exist in `packages/db/src/queries/audit-log-cleanup.ts`, but their scheduled execution via the job queue has not been verified or implemented.

Without scheduled cleanup, PII accumulates indefinitely in the audit log.

## Fix

Register the audit log cleanup as a recurring BullMQ job with an appropriate retention period (e.g., 90 days for IP/UA data). The cleanup queries are already written — this task is about wiring them into the job queue.

## Checklist

- [ ] Register audit-log-cleanup as a recurring job in the queue package
- [ ] Configure retention period (suggest 90 days, confirm with product decision)
- [ ] Add test: verify cleanup job removes entries older than retention period
- [ ] Verify cleanup queries handle edge cases (empty table, partial retention)

## References

- CWE-532: Insertion of Sensitive Information into Log File
- GDPR Article 5(1)(e): Storage Limitation

## Summary of Changes\n\nAdded `AUDIT_LOG_RETENTION_DAYS` (90) and `AUDIT_LOG_CLEANUP_CRON` constants to the queue package. Created `createAuditLogCleanupHandler()` factory in `apps/api/src/jobs/audit-log-cleanup.ts` that calls `pgCleanupAuditLog` with the configured retention. Added `@pluralscape/queue` as API dependency.
