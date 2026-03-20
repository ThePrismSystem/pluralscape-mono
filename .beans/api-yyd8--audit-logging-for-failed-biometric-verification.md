---
# api-yyd8
title: Audit logging for failed biometric verification
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T10:11:00Z
parent: api-765x
---

M9: Write audit log entries for failed biometric verification attempts for security monitoring.

## Acceptance Criteria

- Failed biometric verification writes audit log entry
- Audit entry includes: accountId, sessionId, timestamp, event type (BIOMETRIC_VERIFY_FAILED)
- Successful biometric verification does NOT write a failure entry
- Integration test: failed biometric attempt → verify audit row with correct event type

## Summary of Changes

- Added `auth.biometric-failed` to `AuditEventType` union in `packages/types/src/audit-log.ts`
- Added audit write call in the `!match` branch of `verifyBiometric()` in `apps/api/src/services/biometric.service.ts`
- Added test case verifying audit is written before throwing in `biometric.service.test.ts`
