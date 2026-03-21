---
# api-e753
title: Split hierarchy-service-factory into types and helpers modules
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:05:07Z
updated_at: 2026-03-21T03:10:45Z
parent: ps-irrf
---

## Summary of Changes

Split `hierarchy-service-factory.ts` (634 lines) into three focused modules:

- **`hierarchy-service-types.ts`** — All type definitions: `AnyPgColumn`, `HierarchyColumns`, `DependentCheck`, `HierarchyServiceConfig`, `BaseHierarchyResult`, and `HierarchyService` interface
- **`hierarchy-service-helpers.ts`** — Pure utility functions: `mapBaseFields` (base column mapping) and `checkDependents` (dependent-table guard before delete)
- **`hierarchy-service-factory.ts`** — The `createHierarchyService` factory function (~300 lines), with re-exports from the new modules to maintain backward compatibility

No behavior changes. All existing imports from `hierarchy-service-factory.js` continue to work via re-exports.
