---
# api-7ds5
title: Refactor board-message.service.ts (552 LOC) into services/board-message/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:28Z
parent: api-6l1q
---

Split apps/api/src/services/board-message.service.ts (552 LOC) into apps/api/src/services/board-message/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates board thread CRUD / pin/unpin / acknowledgement dispatch in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/board-message/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/board-message.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/board-message/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- apps/api/src/services/board-message.service.ts (pre-split) — `board-message.service` module mixed 10 exports across 8 verb categories with inline toBoardMessageResult helper; split into verb files following services/member pattern (Option E, no barrel) — info
- apps/api/src/__tests__/services/board-message.service.test.ts — unit test uses `await import` after `vi.mock`, forcing tests to mock each verb module path individually after split — info
- apps/api/src/__tests__/routes/board-messages/crud.test.ts — preserves `parseBoardMessageQuery` via importOriginal on queries.js mock; other service mocks are pure vi.fn() — info

## Summary of Changes

board-message.service.ts (552 LOC) → services/board-message/ (8 files: create, queries, update, pin, reorder, delete, lifecycle, internal). Max 139 LOC. 15 callers updated. No barrel (Option E).

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
