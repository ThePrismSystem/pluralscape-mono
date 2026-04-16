---
# ps-sx0n
title: Fix all PR review issues for M2 API
status: completed
type: task
priority: high
created_at: 2026-03-17T22:12:06Z
updated_at: 2026-04-16T07:29:44Z
parent: ps-rdqo
---

Address 12 PR review items: extract shared helpers, fix TOCTOU race, add unique index on tokenHash, require current PIN for removal, worker thread offload for PIN hashing, fix optional field handling, fix verifyPinCode error differentiation, add route tests, add blob validation tests

## Summary of Changes

### Phase 1: Extract shared helpers

- Created `apps/api/src/lib/verify-system-ownership.ts` — extracted from 4 services
- Created `apps/api/src/lib/validate-encrypted-blob.ts` — extracted from 3 services
- Exported `toSystemSettingsResult` from system-settings.service.ts for reuse in setup.service.ts
- Added `SetupStepName` type to `packages/types/src/audit-log.ts` with `satisfies` assertions

### Phase 2: Critical fixes

- Fixed TOCTOU race in `setupComplete` using transaction + `onConflictDoNothing`
- Added unique index on `biometric_tokens.token_hash` with migration

### Phase 3: Important fixes

- Added `RemovePinBodySchema` — PIN removal now requires current PIN verification
- Created worker thread pool (`pwhash-worker-thread.ts` + `pwhash-offload.ts`) for non-blocking PIN hashing
- Fixed optional field handling in `updateSystemSettings` using conditional spread
- Fixed `verifyPinCode` to differentiate missing settings, no PIN set, and wrong PIN errors

### Phase 4: Tests

- Added 4 route integration test files (pin, nomenclature, settings, setup)
- Added blob-too-large validation tests to all 3 service test files
- Updated all existing service tests for new module structure
