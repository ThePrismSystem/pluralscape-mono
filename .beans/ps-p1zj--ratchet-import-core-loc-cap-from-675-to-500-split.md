---
# ps-p1zj
title: Ratchet import-core LOC cap from 675 to 500 (split import-engine.ts)
status: completed
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T12:13:13Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split packages/import-core/src/import-engine.ts (currently 661 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 675 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md

## Summary of Changes

Split packages/import-core/src/import-engine.ts (661 LOC) into:

- import-engine.ts — orchestrator + public types (332 LOC)
- import-engine.helpers.ts — isAborted, delta, buildPersistableEntity, indexOfResumeCollection (84 LOC)
- import-engine.collection.ts — EngineRunContext, persistMapperResult, runBatchCollection, runSingleCollection (368 LOC)

Per-collection iteration extracted with explicit EngineRunContext arg replacing closure capture. Lowered B13 cap in tooling/eslint-config/loc-rules.js from 675 to 500. Public exports preserved (runImportEngine, buildPersistableEntity, RunImportEngineArgs, BeforeCollectionArgs, BeforeCollectionResult, ImportRunOutcome, ImportRunResult).

Verified: pnpm typecheck, pnpm vitest run --project import-core (124 passed), pnpm vitest run --project import-sp --project import-pk (533 passed), pnpm lint --filter=@pluralscape/import-core, pnpm lint:loc — all pass.
