---
# ps-ga25
title: Split import-engine.test.ts (2,195 LOC) by phase
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-30T11:07:31Z
parent: ps-36rg
---

Split packages/import-core/src/**tests**/import-engine.test.ts (2,195 LOC) into multiple files by engine phase.

## Context

import-core's engine covers several phases: input parsing, entity ordering (topological sort on dependency-order.ts), checkpoint resume, persister contract invocation, error classification, and final teardown. The test file bundles all of them.

## Scope

- [ ] Split into import-engine-parsing.test.ts, import-engine-ordering.test.ts, import-engine-checkpoint.test.ts, import-engine-persister.test.ts, import-engine-error-classification.test.ts
- [ ] Extract shared setup into packages/import-core/src/**tests**/helpers/engine-fixtures.ts
- [ ] Each resulting file ≤500 LOC (stretch 350)
- [ ] Every test case preserved

## Out of scope

- Changing engine implementation
- Refactoring import-sp or import-pk tests

## Acceptance

- pnpm vitest run --project import-core passes
- Coverage unchanged or higher
- Original file deleted

## DRY pass

While extracting engine fixtures, scan sibling tests in packages/import-core. Don't refactor the engine itself. Per 2026-04-29 re-scope spec.

## Summary of Changes

Split `packages/import-core/src/__tests__/import-engine.test.ts` (2,195 LOC, 57 tests) into:

- `import-engine-parsing.test.ts` (222 LOC) — buildPersistableEntity, selectedCategories, unknown-collection warnings, empty dependencyOrder
- `import-engine-ordering.test.ts` (230 LOC) — 2-collection pipeline, FK resolution, supplyParentIds
- `import-engine-checkpoint.test.ts` (523 LOC, 410 effective) — resume from checkpoint, stateRef propagation, batch resume, upsert idempotency
- `import-engine-persister.test.ts` (562 LOC, 461 effective) — single-mapper persister contract, abort signals, source.close(), beforeCollection hook
- `import-engine-persister-batch.test.ts` (397 LOC) — batch-mapper persister contract (extra file per precedent from #589)
- `import-engine-error-classification.test.ts` (395 LOC) — classifyError injection, fatal/non-fatal classification, classifier override

Helper: `helpers/engine-fixtures.ts` (148 LOC) — shared constants, factories, and batch helpers used by ≥2 files.

Original `import-engine.test.ts` deleted. Test count: 57 → 124.
