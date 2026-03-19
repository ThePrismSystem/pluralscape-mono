---
# api-yyd8
title: Audit logging for failed biometric verification
status: todo
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M9: Write audit log entries for failed biometric verification attempts for security monitoring.

## Acceptance Criteria

- Failed biometric verification writes audit log entry
- Audit entry includes: accountId, sessionId, timestamp, event type (BIOMETRIC_VERIFY_FAILED)
- Successful biometric verification does NOT write a failure entry
- Integration test: failed biometric attempt → verify audit row with correct event type
