---
# api-5psf
title: Investigate createHierarchyService factory re-export TS inference quirk
status: completed
type: task
priority: low
created_at: 2026-04-21T21:56:01Z
updated_at: 2026-04-22T07:45:46Z
parent: api-6l1q
---

## Context

During api-6l1q api-jhyt (group service refactor), bare re-exports of factory methods (e.g. `export const createGroup = groupHierarchy.create`) were inferred as `any` at call sites, triggering `@typescript-eslint/no-unsafe-call`. Worked around by adding explicit function-type annotations to the re-exports.

This suggests TS's generic inference may not propagate cleanly through factory method re-exports. Other services using factory patterns (createHierarchyService or similar) may have the same issue — worth a sweep.

Known instances:

- apps/api/src/services/group/{create,update,lifecycle,queries}.ts — workaround applied, explicit types

## Scope

- [ ] Grep for `createHierarchyService` and similar factory functions in services/
- [ ] For each factory consumer, check if method re-exports lose inference
- [ ] If pattern repeats: consider a helper type `FactoryMethodType<Factory, K>` to make annotations less boilerplate
- [ ] Alternatively, evaluate wrapping factory methods in thin function wrappers that preserve types natively
- [ ] Document the chosen pattern

## Acceptance

- Sweep complete
- Either all factory-method re-exports follow a consistent pattern, or a decision recorded not to use factories this way
- No `no-unsafe-call` regressions introduced

## Summary of Changes

Re-evaluated createHierarchyService factory method re-export inference in group verb files. Outcome A: TS inference now propagates cleanly through bare factory re-exports — typecheck + lint both pass without explicit function-type annotations. Simplified all 7 re-exports across create.ts, update.ts, lifecycle.ts, queries.ts to bare assignments (e.g. `export const createGroup = groupHierarchy.create`). Net -56 LOC. Documented inline in each of the 4 verb files with a 2-line comment referencing api-5psf. No FactoryMethodType helper added (single consumer — not warranted).
