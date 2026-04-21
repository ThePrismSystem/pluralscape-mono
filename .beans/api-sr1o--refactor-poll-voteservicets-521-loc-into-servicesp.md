---
# api-sr1o
title: Refactor poll-vote.service.ts (521 LOC) into services/poll-vote/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:57Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/poll-vote.service.ts (521 LOC) into apps/api/src/services/poll-vote/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates vote recording / tally / closure / voter identity handling in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/poll-vote/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/poll-vote.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/poll-vote/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Summary of Changes

poll-vote.service.ts (521 LOC) → services/poll-vote/ (6 files: cast, update, results, list, archive, internal). Max 157 LOC. 10 callers updated. No barrel (Option E). Will be relocated under services/poll/votes/ in PR 2.

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
