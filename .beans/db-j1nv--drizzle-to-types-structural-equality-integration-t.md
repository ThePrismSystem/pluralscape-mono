---
# db-j1nv
title: Drizzle-to-types structural-equality integration tests
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T13:55:39Z
updated_at: 2026-04-22T23:06:07Z
parent: types-ltel
blocked_by:
  - types-f62m
---

Per-entity integration test asserting that the Drizzle row-inference type equals the packages/types <Entity>ServerMetadata shape. Catches schema drift between DB columns and the declared domain metadata.

## Context

Drizzle's InferSelectModel<typeof table> produces a TS type from the schema definition. Comparing it structurally to <Entity>ServerMetadata from packages/types ensures the two stay aligned without full codegen. Pattern:

    type _MemberRowMatches = Assert<Equal<
      InferSelectModel<typeof members>,
      MemberServerMetadata
    >>;

where Assert / Equal are standard type-level equality helpers (compile error = drift).

## Scope

- [ ] Add type-level Assert / Equal helpers in packages/db/src/**tests**/helpers/type-assertions.ts (or reuse an existing helper if already present)
- [ ] For every entity published by the sibling types-pairs task, write a structural-equality check
- [ ] Handle entities that have both PG and SQLite schema — one assertion per dialect
- [ ] Ensure no test-only columns (e.g. search triggers) break the assertion; exclude them explicitly with a documented reason

## Out of scope

- Refactoring Drizzle columns to match types (types definition is the SoT; Drizzle changes land here only when drift is real)
- Zod parity (sibling task)

## Acceptance

- pnpm typecheck passes
- pnpm vitest run --project db-integration passes
- Dropping a field from packages/types causes pnpm typecheck to fail

## Blocked-by

types- bean "Publish <Entity> and <Entity>ServerMetadata pairs in packages/types"

## Notes

These are compile-time assertions, not runtime tests — they live in **tests** directories for convention but never execute at runtime.

## Phase 1 pilot progress (2026-04-22)

Pilot Drizzle parity delivered: `packages/db/src/__tests__/type-parity/member.type.test.ts` and `audit-log-entry.type.test.ts` assert `InferSelectModel<typeof table>` structurally equals `<Entity>ServerMetadata` modulo brand-stripping (see `__helpers__.ts`). Brand-drift follow-up tracked as `db-drq1`. Manifest completeness gate added in `__manifest-completeness__.type.test.ts`.

Remaining (fleet, Phase 2): parity tests for the remaining ~23 entities. Pattern is established — copy the pilot files, rename, point at the target Drizzle table.
