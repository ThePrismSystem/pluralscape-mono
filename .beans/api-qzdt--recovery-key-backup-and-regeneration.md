---
# api-qzdt
title: Recovery key backup and regeneration
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:52:38Z
updated_at: 2026-03-17T07:48:35Z
parent: api-o89k
blocked_by:
  - api-1v5r
  - api-e0c2
---

POST /auth/recovery-key/regenerate (revoke old, generate new encrypted master key backup, audit log). GET /auth/recovery-key/status (has active key, not the key itself).

## Summary of Changes

- Added `RegenerateRecoveryKeySchema` to `@pluralscape/validation` (currentPassword + confirmed boolean)
- Created `recovery-key.service.ts` with `getRecoveryKeyStatus()` and `regenerateRecoveryKeyBackup()`
- Created `recovery-key.ts` route handler: GET `/status` (authLight) and POST `/regenerate` (authHeavy)
- Mounted routes at `/auth/recovery-key` in auth router
- Full test coverage: 7 validation tests, 13 service tests, 7 route tests (38 total new tests)
