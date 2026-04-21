---
# api-9si2
title: Refactor member-photo.service.ts (589 LOC) into services/member-photo/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/member-photo.service.ts (589 LOC) into apps/api/src/services/member-photo/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates photo upload / blob linkage / member denormalization in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/member-photo/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/member-photo.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/member-photo/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- services/member-photo.service.ts:3 — imported `brandId` but was unused post-split (only needed in internal.ts's toPhotoResult); removed during split — low
- No circular imports; verb files import from ./internal.js only; no back-edges — low
- Integration test harness in api project produces "DB timeout" log noise for route tests that lack a live PG (428/428 test files pass, 5331/5331 tests pass); pre-existing, unrelated to this refactor — low
- Max verb file LOC: lifecycle.ts at 204 (well under 300 target); total 627 vs. original 589 due to per-file imports — low

## Summary of Changes

member-photo.service.ts (589 LOC) → services/member/photos/ (5 files: create, queries, update, lifecycle, internal). Nested under the api-trlq member/ directory. Max 204 LOC. 18 callers updated. No barrel (Option E).

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
