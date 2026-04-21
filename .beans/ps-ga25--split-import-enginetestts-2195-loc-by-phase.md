---
# ps-ga25
title: Split import-engine.test.ts (2,195 LOC) by phase
status: todo
type: task
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-21T13:57:36Z
parent: ps-36rg
---

Split packages/import-core/src/**tests**/import-engine.test.ts (2,195 LOC) into multiple files by engine phase.

## Context

import-core's engine covers several phases: input parsing, entity ordering (topological sort on dependency-order.ts), checkpoint resume, persister contract invocation, error classification, and final teardown. The test file bundles all of them.

## Scope

- [ ] Split into import-engine-parsing.test.ts, import-engine-ordering.test.ts, import-engine-checkpoint.test.ts, import-engine-persister.test.ts, import-engine-error-classification.test.ts
- [ ] Extract shared setup into packages/import-core/src/**tests**/helpers/engine-fixtures.ts
- [ ] Each resulting file ≤500 LOC
- [ ] Every test case preserved

## Out of scope

- Changing engine implementation
- Refactoring import-sp or import-pk tests

## Acceptance

- pnpm vitest run --project import-core passes
- Coverage unchanged or higher
- Original file deleted
