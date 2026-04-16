---
# api-ehwh
title: "Fix all PR #329 review issues"
status: completed
type: task
priority: high
created_at: 2026-03-30T03:56:37Z
updated_at: 2026-04-16T07:29:50Z
parent: ps-n8uk
---

Address all 20 review items from PR #329 multi-model review: 3 critical, 4 important, 6 simplifications, 2 type fixes, 5 test gaps.

## Checklist

### Phase 1: Constants Consolidation (S1)

- [x] Delete 6 duplicate constants files
- [x] Update 6 list route imports to use service.constants

### Phase 2: Type Fixes (T1, T2)

- [x] T1: Branded IDs in structure-entity result types
- [x] T2: FriendDashboardSyncEntry.entityType → BucketContentEntityType

### Phase 3: Split structure-entity.service.ts (S6)

- [x] Split into 5 focused modules with barrel re-export

### Phase 4: Critical Fixes (C1, C2, C3)

- [x] C1: Fix TOCTOU in approveTransfer
- [x] C2: Add assertSystemOwnership to snapshot service
- [x] C3: Cap limit in friends list

### Phase 5: Important Fixes (I1, I2, I3)

- [x] I1: Offload verifyPassword to worker thread
- [x] I2: Validate entityTypeId query param
- [x] I3: FOR UPDATE on entity delete

### Phase 6: Extract assertEntityActive (S3)

- [x] Extract generic helper, rewrite 4 wrappers

### Phase 7: Extract bucketFilteredSyncEntry (S4)

- [x] Extract generic, replace 3 entry functions

### Phase 8: Remove Legacy Field Value Wrappers (S5)

- [x] Delete 4 wrapper functions, update callers

### Phase 9: Field Value Route Factory (S2)

- [x] Create factory, replace 12 route files

### Phase 10: Test Gaps (TG1-TG5)

- [x] TG1: Account deletion service tests
- [x] TG2: API keys route error paths
- [x] TG3: Structure entity route error paths
- [x] TG4: Snapshot list pagination tests
- [x] TG5: Poll vote abstain test

### Phase 11: Verification

- [x] Format, lint, typecheck, all tests pass

## Summary of Changes

Addressed all 20 review items from PR #329:

- **Critical**: TOCTOU fix in approveTransfer, assertSystemOwnership in snapshot service, friends list limit cap
- **Important**: verifyPassword offloaded to worker thread, entityTypeId validation, FOR UPDATE on entity deletes
- **Types**: Branded IDs in structure-entity result types, FriendDashboardSyncEntry.entityType
- **Simplifications**: Constants consolidation, split structure-entity service into 5 modules, assertEntityActive generic, bucketFilteredSyncEntry generic, removed legacy field value wrappers, field value route factory
- **Tests**: Account deletion service, API keys error paths, structure entity error paths, snapshot pagination, poll vote abstain
