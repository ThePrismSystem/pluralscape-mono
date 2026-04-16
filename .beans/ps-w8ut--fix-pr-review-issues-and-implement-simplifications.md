---
# ps-w8ut
title: Fix PR review issues and implement simplifications
status: completed
type: task
priority: normal
created_at: 2026-03-17T22:07:41Z
updated_at: 2026-04-16T07:29:44Z
parent: ps-rdqo
---

Addresses 3 critical bugs, 7 important issues, and 10 simplification suggestions from PR review of Groups + Custom Fronts feature

## Summary of Changes

### Phase 1: Shared Constants Consolidation

- Created `apps/api/src/service.constants.ts` with unified `MAX_ENCRYPTED_DATA_BYTES`, `DEFAULT_PAGE_LIMIT`, `MAX_PAGE_LIMIT`
- Removed duplicated constants from `groups.constants.ts`, `custom-fronts.constants.ts`, `systems.constants.ts`
- Unified validation constants: replaced `MAX_ENCRYPTED_SYSTEM_DATA_SIZE`, `MAX_ENCRYPTED_GROUP_DATA_SIZE`, `MAX_ENCRYPTED_CUSTOM_FRONT_DATA_SIZE` with single `MAX_ENCRYPTED_DATA_SIZE = 87_382` (aligned with 64 KiB service-layer limit)

### Phase 2: Shared Service Helpers

- Extracted `assertSystemOwnership` to `lib/assert-system-ownership.ts`
- Extracted `encryptedBlobToBase64`, `encryptedBlobToBase64OrNull`, `parseAndValidateBlob` to `lib/encrypted-blob.ts`
- Extracted `assertOccUpdated` OCC pattern to `lib/occ-update.ts`
- Extracted `parseJsonBody` to `lib/parse-json-body.ts`
- Extracted `parsePaginationLimit` to `lib/pagination.ts`
- Updated all 4 service files and 12 route handlers to use shared helpers

### Phase 3: Critical Bug Fixes

- Fixed broken cursor pagination in `listGroups` (ordered by `groups.id` instead of `groups.sortOrder, groups.id`)
- Added `updated.length` check in `restoreGroup` before destructuring
- Added `updated.length` check in `restoreCustomFront` before destructuring

### Phase 4: Important Fixes

- Added `group.deleted` and `custom-front.deleted` audit event types
- Fixed `deleteGroup` and `deleteCustomFront` to use correct audit events
- Added branded string validation for ID fields in group schemas
- Fixed `moveGroup` cycle detection to reject when MAX_ANCESTOR_DEPTH exhausted
- Fixed `moveGroup` to throw on missing ancestor (integrity violation)
- Replaced `?? 0` fallbacks on count queries with proper null checks
- Batched audit writes in `reorderGroups` (single audit entry instead of per-operation)

### Phase 5: Test Updates

- Updated all service, validation, type, and enum tests for new constants and behavior
- Updated audit event expectations for `deleteGroup`/`deleteCustomFront`
- Updated oversized blob tests to expect VALIDATION_ERROR (Zod catches before service layer)

### Phase 6: Migration

- Generated PG and SQLite migrations for updated audit_log CHECK constraint
