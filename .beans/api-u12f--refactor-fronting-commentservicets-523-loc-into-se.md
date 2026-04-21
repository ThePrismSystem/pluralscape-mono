---
# api-u12f
title: Refactor fronting-comment.service.ts (523 LOC) into services/fronting-comment/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:57Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/fronting-comment.service.ts (523 LOC) into apps/api/src/services/fronting-comment/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates per-session commentary / author resolution / visibility in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [x] Create apps/api/src/services/fronting-session/comments/ directory (Wave 2 Option E nesting, no barrel)
- [x] Split into per-verb files (create/queries/update/lifecycle/internal); callers import directly from the specific verb file
- [x] Keep existing public exports identical
- [x] Preserve all existing tests; no coverage regression
- [x] Each resulting file ≤300 LOC; stretch target 200 LOC
- [x] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/fronting-comment.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/fronting-comment/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- apps/api/src/services/fronting-comment.service.ts:523 — split into services/fronting-session/comments/ (Option E nesting, NO barrel). Files: internal.ts (61), create.ts (105), queries.ts (111), update.ts (88), lifecycle.ts (189). Max 189 LOC. — surprising
- resolveSessionStartTime helper is single-consumer (only create.ts) — kept module-local rather than promoting to internal.ts. — by-convention
- apps/api/src/**tests**/trpc/routers/fronting-comment.test.ts:22 — original mock omitted deleteFrontingComment despite the router using it; preserved that behavior in the split lifecycle mock (still omitted). Test never exercises the delete procedure. — surprising

## Summary of Changes

fronting-comment.service.ts (523 LOC) → services/fronting-session/comments/ (5 files: create, queries, update, lifecycle, internal). Nested under api-w0lh's fronting-session/ directory. Max 189 LOC. 14 callers updated. No barrel (Option E). Finding surfaced → api-3vsr (test coverage for delete procedure).

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
