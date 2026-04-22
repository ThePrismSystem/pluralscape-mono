---
# api-ss6i
title: Resolve poll/votes nesting mismatch with routes/polls flat vote files
status: completed
type: task
priority: normal
created_at: 2026-04-22T02:43:15Z
updated_at: 2026-04-22T03:31:57Z
parent: api-6l1q
---

Discovered during api-6l1q PR 2 findings review (post-api-gfo9).

## Problem

The api-6l1q nesting rule: service nests under parent iff routes tree does AND both in refactor scope.

- PR 1 had `services/poll-vote/` as a sibling to `services/poll/`
- PR 2 (api-gfo9) relocated it to `services/poll/votes/` (nested under poll/)
- Routes for voting are flat inside `routes/polls/`: `cast-vote.ts`, `delete-vote.ts`, `list-votes.ts`, `update-vote.ts`, `results.ts`
- There is no `routes/polls/votes/` directory

This violates the nesting rule.

## Options

A. **Denest services/poll/votes/ back to services/poll-vote/** — restores rule parity without touching routes. Simplest.
B. **Nest routes/polls/{cast,delete,list,update}-vote.ts + results.ts into routes/polls/votes/** — consistent with services; touches more files and requires updating the polls router.
C. **Accept the mismatch and amend the rule** — document that votes are semantically a child of polls even though routes stayed flat.

## Scope

- Pick an option; implement
- If A: move services/poll/votes/ back to services/poll-vote/; update imports in polls router, polls routes, tests
- If B: move routes/polls/_vote_.ts into routes/polls/votes/; update Hono route mounting
- If C: update docs/CLAUDE.md with the exception

## Acceptance

- Nesting rule parity restored OR documented exception
- Verify suite passes

## Summary of Changes

Applied **Option A**: denested `services/poll/votes/` back to `services/poll-vote/`.

- `git mv apps/api/src/services/poll/votes/ apps/api/src/services/poll-vote/` (6 files: archive, cast, internal, list, results, update)
- Adjusted relative imports inside the 6 moved files (`../../../` -> `../../`, `../../webhook-dispatcher.js` -> `../webhook-dispatcher.js`)
- Updated 5 route imports (`routes/polls/{cast-vote,delete-vote,list-votes,update-vote,results}.ts`)
- Updated tRPC router (`trpc/routers/poll.ts`, 5 imports)
- Updated 7 test files (44 occurrences)

Nesting rule parity restored. Lint + typecheck + full api unit suite (5331 tests) all green.
