---
# api-20q6
title: Refactor innerworld-region.service.ts (544 LOC) into services/innerworld-region/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T21:08:04Z
parent: api-6l1q
---

Split apps/api/src/services/innerworld-region.service.ts (544 LOC) into apps/api/src/services/innerworld-region/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates region CRUD / canvas relationships / sort ordering in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/innerworld-region/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/innerworld-region.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/innerworld-region/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.
