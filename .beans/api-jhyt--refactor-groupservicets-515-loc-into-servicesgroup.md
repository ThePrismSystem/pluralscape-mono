---
# api-jhyt
title: Refactor group.service.ts (515 LOC) into services/group/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T13:56:57Z
updated_at: 2026-04-21T21:31:52Z
parent: api-6l1q
---

Split apps/api/src/services/group.service.ts (515 LOC) into apps/api/src/services/group/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates group CRUD / member assignment / hierarchy in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/group/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/group.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/group/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- apps/api/src/services/group.service.ts:515 — monolithic file with Types/Helpers/shared hierarchy factory + 10 exported funcs; shares one `createHierarchyService` instance used across create/update/list/get/delete/archive/restore — requires factory in internal.ts — low
- apps/api/src/services/group/create.ts, update.ts, lifecycle.ts, queries.ts — bare re-exports of factory methods (e.g. `export const createGroup = groupHierarchy.create`) inferred to `any` at call sites (likely due to TS generic resolution across re-export) causing @typescript-eslint/no-unsafe-call in callers; added explicit function-type annotations to restore inference — medium
- apps/api/src/**tests**/routes/groups/list.test.ts:109 — when re-exporting `GroupResult` type through queries.ts the unsafe-argument check triggered until `export type { GroupResult } from "./internal.js"` was added — low
