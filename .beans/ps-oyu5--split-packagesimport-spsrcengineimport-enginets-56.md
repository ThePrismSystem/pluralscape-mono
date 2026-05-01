---
# ps-oyu5
title: Split packages/import-sp/src/engine/import-engine.ts (568 to <=500)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:13Z
updated_at: 2026-04-30T22:42:10Z
parent: ps-r5p7
---

## Summary of Changes

Split engine/import-engine.ts (568 LOC) into:

- packages/import-sp/src/engine/orchestrator-helpers.ts (198 LOC) — internal helpers: isAborted, delta, buildPersistableEntity, makeAbortedResult, makeCompletedResult, RunImportArgs, indexOfResumeCollection, persistSynthesizedBuckets, KNOWN_DEPENDENCY_ORDER_SET
- packages/import-sp/src/engine/import-engine.ts (410 LOC) — runImport orchestrator + barrel re-exports at same path

Original path preserved as orchestrator; all public exports (runImport, buildPersistableEntity, RunImportArgs, ImportRunResult, ImportRunOutcome, collectionToEntityType, entityTypeToCollection, emptyCheckpointState) reachable at the same import path.
