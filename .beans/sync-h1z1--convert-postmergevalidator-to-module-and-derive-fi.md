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

- Extracted all class methods to module-level functions
- Exported `runAllValidations` as the primary public API
- Kept a thin `PostMergeValidator` class wrapper that delegates to module functions (sync-engine.ts still instantiates the class and is out of scope)
- Updated `packages/sync/src/index.ts` to export `runAllValidations`

**S-H3: Derive ENTITY_FIELD_MAP from CRDT strategies**

- Added `fieldName: string` property to the `CrdtStrategy` interface
- Added field names to all 44 entries in `ENTITY_CRDT_STRATEGIES`
- Deleted the manually maintained 27-entry `ENTITY_FIELD_MAP` object literal
- Derived `ENTITY_FIELD_MAP` from `ENTITY_CRDT_STRATEGIES` at module load time
- Added tests verifying the derived map matches expected entries and covers all strategy keys

**P-M7: Optimize enforceTombstones for targeted scans**

- Added optional `modifiedEntityTypes?: Set<string>` parameter to `enforceTombstones`
- When provided, only entity types in the set are scanned (skips unmodified types)
- `runAllValidations` calls `extractModifiedEntityTypes()` to inspect Automerge change ops
- Falls back to full scan when extraction fails or yields no results
- Added 4 new tests covering targeted scan, full scan, and empty set behavior

**Follow-up needed:**

- Update `sync-engine.ts` to call `runAllValidations()` directly instead of instantiating `PostMergeValidator` class, then remove the class wrapper
