---
# sync-qh8l
title: "Test coverage: sync materializer/ has zero dedicated tests"
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:49:04Z
parent: sync-me6c
---

Finding [GAP-1] from audit 2026-04-20. packages/sync/src/materializer/base-materializer.ts (203L, diffEntities, entityToRow), materialize-document.ts, extract-entities.ts, entity-registry.ts, materializer-registry.ts, local-schema.ts. Document-to-SQLite projection layer untested.

## Summary of Changes

Dedicated test files for each materializer module now exist and run
green:

- base-materializer.test.ts (360 lines)
- entity-registry.test.ts (196 lines)
- extract-entities.test.ts (357 lines)
- local-schema.test.ts (extended with generateAllDdl tests)
- materialize-document.test.ts (381 lines; includes dirty-entity-types)
- materializer-registry.test.ts (extended with materialize-delegation
  and dirty-set propagation tests)

Combined unit-test coverage for the materializer directory sits at
92-96% (branches, statements, lines, functions) — comfortably above
the 89% threshold.
