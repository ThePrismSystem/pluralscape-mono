---
# ps-l2el
title: "Umbrella: split remaining 16 test files over 1,000 LOC"
status: scrapped
type: task
priority: normal
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-30T04:59:58Z
parent: ps-36rg
---

Systematic split of the remaining 16 test files over 1,000 LOC, following the pattern established by the three named-split beans (sync, db-rls, import-engine). One PR per file, not parallelized in a single bean.

## Context

19 test files exceeded 1,000 LOC as of 2026-04-21. The three worst are tracked in sibling beans. This umbrella covers the remaining 16.

## Scope — one checkbox per file

- [ ] apps/mobile/src/data/**tests**/row-transforms.test.ts (2,013)
- [ ] packages/db/src/**tests**/helpers/sqlite-helpers.ts (1,860) — test helper, not a test file; split by responsibility (schema init / fixture factory / transaction helpers)
- [ ] packages/db/src/**tests**/schema-sqlite-structure.integration.test.ts (1,770)
- [ ] packages/db/src/**tests**/schema-pg-structure.integration.test.ts (1,640)
- [ ] packages/db/src/**tests**/schema-pg-communication.integration.test.ts (1,562)
- [ ] packages/sync/src/**tests**/conflict-resolution.test.ts (1,548)
- [ ] packages/db/src/**tests**/schema-sqlite-communication.integration.test.ts (1,512)
- [ ] apps/api/src/**tests**/services/auth.service.test.ts (1,413) — coordinate with api-huu3 (auth service refactor) so test split lands after the service split
- [ ] apps/api/src/**tests**/ws/message-router.test.ts (1,406)
- [ ] packages/db/src/**tests**/schema-sqlite-custom-fields.integration.test.ts (1,361)
- [ ] apps/api/src/**tests**/services/structure-entity.service.test.ts (1,348)
- [ ] apps/api/src/**tests**/services/analytics.service.test.ts (1,245)
- [ ] packages/db/src/**tests**/schema-sqlite-privacy.integration.test.ts (1,323)
- [ ] apps/mobile/src/features/import-sp/**tests**/trpc-persister-api.test.ts (1,249)
- [ ] packages/db/src/**tests**/schema-pg-custom-fields.integration.test.ts (1,227)
- [ ] packages/db/src/**tests**/schema-sqlite-fronting.integration.test.ts (1,160)

## Acceptance per file

- File ≤600 LOC after split; every test preserved; relevant vitest project passes; coverage unchanged or higher
- Umbrella bean completed only when all 16 boxes are checked and each underlying PR merged

## Reasons for Scrapping

Replaced by package-batched T2 beans per the 2026-04-29 re-scope spec (docs/superpowers/specs/2026-04-29-test-file-split-epic-design.md). The original 16-file umbrella structure didn't match the new tiered batching strategy. New T2 beans are direct children of ps-36rg, blocked-by the three T1 named-split beans.
