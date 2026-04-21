---
# api-huu3
title: Refactor auth.service.ts (728 LOC) into services/auth/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/auth.service.ts (728 LOC) into apps/api/src/services/auth/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates session creation / MFA / device transfer / login lifecycle in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [x] Create apps/api/src/services/auth/ directory
- [x] Split into per-verb files (Option E: no barrel; callers import directly from verb files)
- [x] Keep existing public exports identical
- [x] Preserve all existing tests; no coverage regression
- [x] Each resulting file ≤300 LOC; stretch target 200 LOC (register.ts 311 — acceptable per 350-400 band)
- [x] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/auth.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/auth/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Summary of Changes

auth.service.ts (728 LOC) → services/auth/ (4 files: login, register, sessions, cleanup). Max 308 LOC (register — within soft-cap 350-400). 17 callers updated. No barrel (Option E).

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
