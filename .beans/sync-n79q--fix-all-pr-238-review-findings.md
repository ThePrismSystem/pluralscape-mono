---
# sync-n79q
title: "Fix all PR #238 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-22T09:23:36Z
updated_at: 2026-03-22T09:32:03Z
---

Fix 3 critical, 8 important, 7 suggestion-level issues from multi-model review of PR #238. Includes parent-scoped sort normalization, CRDT type consistency, discriminated union for CrdtFieldValue, strategy metadata corrections, docs, and comprehensive test coverage.

## Summary of Changes

Fixed all 18 issues from multi-model PR #238 review:

**Critical fixes:**

- Added parent-scoped sort normalization via `sortGroupField` on CrdtStrategy — prevents sibling ordering corruption across different parents
- Added `partitionByGroupField()` to post-merge-validator for parent-aware tie detection
- Added 4 conflict-resolution merge tests (Category 6b) for LWW structure entity link semantics
- Added 3 parent-scoped sort normalization tests

**Type consistency:**

- Created `CrdtStructureEntityLinkBase` shared base extending CrdtAuditFields (adds updatedAt)
- Added `archived: boolean` to all three link types
- Created `CrdtFieldValueOwner` discriminated union enforcing exactly one owner field at compile time
- Changed CrdtFieldValue from interface to type alias with union intersection

**Strategy and docs:**

- Added `sortGroupField` and JSDoc to CrdtStrategy interface
- Updated mutationSemantics to distinguish mutable from immutable fields
- Added `scopes` to field-definition mutationSemantics
- Documented LWW delete-wins vs junction add-wins semantic change
- Documented cycle detection exclusion rationale
- Updated sort order trigger list to include all hasSortOrder entities

**Test improvements:**

- 17 new tests (560 total sync tests, 5280 monorepo)
- LWW mutation tests, round-trip test, polymorphic owner permutations
- Strategy metadata assertions for hasSortOrder, sortGroupField
- Simplified junction map factory test
