---
# sync-h1z1
title: Convert PostMergeValidator to module and derive field map from CRDT strategies
status: completed
type: task
created_at: 2026-03-21T03:03:44Z
updated_at: 2026-03-21T03:14:00Z
parent: ps-irrf
---

Implements M3 audit findings S-H2, S-H3, and P-M7 for the post-merge validator.

## Summary of Changes

**S-H2: Convert PostMergeValidator to module pattern**

- Extracted all class methods to exported module-level functions
- Exported `runAllValidations` as the primary public API
- Deleted the `PostMergeValidator` class wrapper entirely
- Updated `sync-engine.ts` to import and call `runAllValidations` directly
- Updated `packages/sync/src/index.ts` to export only `runAllValidations`

**S-H3: Derive all field references from CRDT strategies**

- Added `fieldName: string` property to the `CrdtStrategy` interface
- Added `parentField?: string` for hierarchical entities (group, subsystem, innerworld-region)
- Added `hasSortOrder?: boolean` for sortable entities (group, member-photo, field-definition)
- Deleted the manually maintained 27-entry `ENTITY_FIELD_MAP` object literal
- Derived `ENTITY_FIELD_MAP` from `ENTITY_CRDT_STRATEGIES` at module load time
- Derived `detectHierarchyCycles` field/parent pairs from strategies (no more hardcoded lists)
- Derived `normalizeSortOrder` field list from strategies (no more hardcoded array)
- Added tests verifying the derived map matches expected entries and covers all strategy keys

**P-M7: Removed broken targeted scan optimization**

- Deleted `extractModifiedEntityTypes()` — it used `Automerge.init()` as baseline (scanned full history, not merge delta) and `op.key` captured nested keys, not top-level fields. The optimization never activated.
- Removed `modifiedEntityTypes` parameter from `enforceTombstones`
- Removed associated tests for the deleted feature

**Error observability**

- Added `errors` field to `PostMergeValidationResult` so callers can detect partial validator failures
- Each catch block in `runAllValidations` now pushes to the errors array alongside calling `onError`
- Added `errors` assertions to all `runAllValidations` tests
- Added JSDoc to `FriendConnectionLike.visibility` documenting the JSON-serialized invariant

**New tests**

- 3-node cycle test (A->B->C->A) verifying deterministic parent nulling on lowest-ID entity
- `onError` + errors array verification test
