---
# ps-muvm
title: "Fix PR review issues: security, types, tests, simplification"
status: completed
type: task
priority: normal
created_at: 2026-03-18T08:45:16Z
updated_at: 2026-04-16T07:29:44Z
parent: api-tspr
---

Fix all critical, important, and suggestion-level issues from PR review of feat/audit-012-auth-features

## Summary of Changes

### Critical fixes

- Fixed timing oracle: NoActiveRecoveryKeyError path now has anti-enumeration timing equalization
- Wrapped verifyPassword in try-catch so timing equalization always completes

### Important fixes

- Replaced fragile `error.message.includes("decrypt")` with `instanceof DecryptionFailedError`
- Added `InvalidInputError` catch for malformed recovery key format (was returning 500)
- Added `.returning()` check on recovery key revocation to prevent TOCTOU race
- Added regex constraint on `resource_type` validation (`/^[a-z][a-z0-9-]*$/`)
- Switched `audit-log-query.ts` from `zod` to `zod/v4` for consistency

### Type improvements

- `PasswordResetResult` now uses branded `SessionId` and `AccountId`
- `LifecycleEventResult.plaintextMetadata` now uses `PlaintextMetadata` type
- Added max lengths to `PasswordResetViaRecoveryKeySchema` (recoveryKey: 200, newPassword: 1024)

### Simplifications

- Removed redundant variable alias `backup` in `regenerateRecoveryKeyBackup`
- Removed redundant aliases `wrappedKey`/`recoveryBackup` in `resetPasswordWithRecoveryKey`
- Deduplicated identical Split/Fusion/Unmerge metadata schemas into `TwoOrMoreMembersMetadataSchema`
- Added `.min(1)` to `regionIdArray` for consistency with other ID arrays

### Test improvements

- Added 8 copyGroup service tests (default parent, root copy, membership copy, no-membership, 404 source, 404 target, validation, forbidden)
- Fixed memzero assertion to exact count (6)
- Added TOCTOU revocation race test for password reset
- Added DecryptionFailedError and InvalidInputError route tests
- Added missing lifecycle metadata validation tests (fusion, unmerge, merge 3+, structure-move invalid, innerworld-move empty regions, dormancy-end, archival, form-change, name-change)
