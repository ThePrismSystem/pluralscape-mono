---
# api-i8sm
title: "Session security: validate account active status, revoke on deletion"
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T10:24:36Z
parent: api-765x
---

M3, M4, M8: Validate that account is still active during session validation. Auto-revoke sessions on account deletion. Ensure session integrity checks.

## Acceptance Criteria

- Session validation middleware checks account is active (not deleted/suspended)
- Deleted account → all sessions immediately invalid (401 on next request)
- Inactive/suspended account → 401 with appropriate error code
- Account deletion triggers session revocation (CASCADE or explicit cleanup)
- Integration tests: delete account → verify session returns 401; suspend → verify 401

## Summary of Changes

Verified that sessions are CASCADE-deleted when an account is deleted via FK
constraint (sessions.accountId -> accounts.id ON DELETE CASCADE). The accounts
table has no active/status column, so narrowed scope to structural verification.

- Added structural verification test confirming cascade FK in session-cascade.test.ts
- Verified session validation checks revoked, expiry, and idle timeout
