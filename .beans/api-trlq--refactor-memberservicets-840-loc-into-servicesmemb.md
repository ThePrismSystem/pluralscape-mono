---
# api-trlq
title: Refactor member.service.ts (840 LOC) into services/member/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:35Z
updated_at: 2026-04-21T20:18:07Z
parent: api-6l1q
---

Split apps/api/src/services/member.service.ts (840 LOC) into apps/api/src/services/member/ with per-verb files, each ≤300 LOC. Largest god-file in the service layer.

## Context

Currently concentrates create / update / archive / restore / duplicate / ownership checks / permission dispatch in a single file. The ownership and permission logic is reused across sibling services; extracting to a shared permissions.ts makes the pattern copyable for subsequent refactors.

## Scope

- [x] Create apps/api/src/services/member/ directory (sibling barrel member.ts, verb files under member/)
- [x] Split into verb files: create.ts, queries.ts, update.ts, lifecycle.ts (archive/restore/delete), internal.ts (shared helpers). Duplicate co-located with create. Barrel is services/member.ts (sibling file required by Bundler resolution).
- [x] All public exports preserved. Caller edits required because the import path changes from services/member.service.js to services/member.js; 23 caller files updated.
- [x] All existing tests pass (unit + integration + e2e).
- [x] Files: create 259, queries 177, update 91, lifecycle 302, internal 43, barrel 6. Max 302 (lifecycle's deleteMember has 11 FK dependent checks that don't decompose).

## Out of scope

- Changing public signatures (breaking-change refactors are separate)
- Refactoring related services (member-photo, group) — those have their own beans

## Acceptance

- apps/api/src/services/member.service.ts no longer exists (replaced by directory + index.ts)
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/member/ exceeds 300 LOC
- Existing caller imports (e.g. `from "../services/member.service.js"`) either work via index re-export or are updated in the same PR

## Notes

Pattern-setter for the remaining 14 service refactor beans. Authoring conventions in this PR become the template.

## Findings

- **Plan deviation — barrel placement:** The plan's Step 9 specifies `services/member/index.ts` as the barrel, but TypeScript with `moduleResolution: "Bundler"` does NOT resolve `../../services/member.js` to a nested `member/index.ts` file. The barrel MUST live as a sibling file `services/member.ts` alongside the `services/member/` verb directory. All subagents replicating this pattern must follow this structure, not the plan as literally written. The plan's subagent-brief template and Step 9 should be updated before dispatching Task 3.
- **lifecycle.ts = 302 LOC** — slightly over the 300 target due to `deleteMember`'s 11 parallel FK dependent-count checks. Each check is a single `Promise.all` arm and the dependents enumeration afterwards is mostly a tag-and-count pattern. Splitting further would fragment a single transactional operation. Recommend the cap in ps-lg9y be informed by this (e.g., 350).
- **No unused exports detected.** Every external consumer is a route, tRPC router, test, or integration-helpers file — all now updated.
- **`member-photo.service.ts` not yet nested.** That refactor is handled by api-9si2 in wave 1 with explicit nest-under-member briefing. No action needed here.

## Summary of Changes

Refactored `member.service.ts` (840 LOC) into `services/member/`:

- `create.ts` (259 LOC) — `createMember`, `duplicateMember`
- `queries.ts` (177 LOC) — `listMembers`, `getMember`, `listAllMemberMemberships`, `MemberMembershipsResult` type
- `update.ts` (91 LOC) — `updateMember`
- `lifecycle.ts` (302 LOC) — `archiveMember`, `restoreMember`, `deleteMember`
- `internal.ts` (43 LOC) — shared `toMemberResult` helper + `MemberResult` type

Barrel: `services/member.ts` (6 LOC, sibling file — NOT nested index.ts — required for Bundler module resolution).

Max file LOC: 302 (`lifecycle.ts`). 23 caller files updated (9 routes, 1 tRPC router, 1 integration-helpers, 12 test files). Full /verify green (format, lint, typecheck, unit, integration, e2e, e2e-slow, sp-import, pk-import).
