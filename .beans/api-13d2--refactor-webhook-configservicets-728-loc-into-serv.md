---
# api-13d2
title: Refactor webhook-config.service.ts (728 LOC) into services/webhook-config/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T21:28:04Z
parent: api-6l1q
---

Split apps/api/src/services/webhook-config.service.ts (728 LOC) into apps/api/src/services/webhook-config/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates validation / event dispatch / schema translation in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [x] Create apps/api/src/services/webhook-config/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [x] Keep existing public exports identical
- [x] Preserve all existing tests; no coverage regression
- [x] Each resulting file ≤300 LOC; stretch target 200 LOC
- [x] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/webhook-config.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/webhook-config/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- .beans/api-13d2--refactor-webhook-configservicets-728-loc-into-serv.md:21 — bean scope item mentions an "index.ts re-exporter" but the refactor followed Option E (no barrel) per task prompt; callers import from specific verb files — dead-code/TODO
- apps/api/src/**tests**/helpers/common-route-mocks.ts — the old mockWebhookConfigServiceFactory was replaced with per-verb factories (create/queries/update/lifecycle/test/internal) to match the split service surface — surprising
