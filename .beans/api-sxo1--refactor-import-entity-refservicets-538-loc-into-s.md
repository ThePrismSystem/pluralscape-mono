---
# api-sxo1
title: Refactor import-entity-ref.service.ts (538 LOC) into services/import-entity-ref/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/import-entity-ref.service.ts (538 LOC) into apps/api/src/services/import-entity-ref/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates import cross-references / batch operations / lifecycle cleanup in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/import-entity-ref/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/import-entity-ref.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/import-entity-ref/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- services/import-entity-ref.service.ts:87-226 — toResult switch handles 21 entity-type branches; kept intact in internal.ts since list/lookup/record all rely on it — low
- services/import-entity-ref.service.ts:40 — ImportEntityRefResult is a direct alias of ImportEntityRef; preserved in internal.ts for caller-facing API compat — low
- apps/api/src/**tests**/routes/systems/import-entity-refs/{lookup-batch,upsert-batch}.test.ts — original single vi.mock of the service barrel included every export; now split into 4 per-verb vi.mock calls so the route-side mocks still intercept every service call graph entry — low

## Summary of Changes

import-entity-ref.service.ts (538 LOC) → services/import-entity-ref/ (5 files: list, lookup, record, upsert-batch, internal). Max 152 LOC. 10 callers updated. No barrel (Option E). Will be relocated under services/system/import-entity-refs/ in PR 2.

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
