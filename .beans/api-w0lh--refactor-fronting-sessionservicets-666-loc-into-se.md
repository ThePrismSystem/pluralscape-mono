---
# api-w0lh
title: Refactor fronting-session.service.ts (666 LOC) into services/fronting-session/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/fronting-session.service.ts (666 LOC) into apps/api/src/services/fronting-session/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates co-fronting lifecycle / overlap handling / switch tracking in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [x] Create apps/api/src/services/fronting-session/ directory
- [x] Split into per-verb files (Option E — NO barrel; callers import directly from verb files)
- [x] Keep existing public exports identical
- [x] Preserve all existing tests; no coverage regression
- [x] Each resulting file ≤300 LOC; stretch target 200 LOC (max 233 in queries.ts)
- [x] Follow the conventions established by api-trlq (Option E flat verb-file layout)

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/fronting-session.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/fronting-session/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Summary of Changes

fronting-session.service.ts (666 LOC) → services/fronting-session/ (5 files: create, queries, update, lifecycle, internal). Max 233 LOC. 17 callers updated. No barrel (Option E).

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
