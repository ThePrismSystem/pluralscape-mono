---
# api-trlq
title: Refactor member.service.ts (840 LOC) into services/member/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:35Z
updated_at: 2026-04-21T20:49:03Z
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

## Update: converted to Option E (no barrel)

After research into modern TS best practices (Vercel, Nx, barrel-file ESLint rules), switched from sibling-barrel to no-barrel. Callers now import specific verb files directly:

```typescript
// Before (Option B — sibling barrel)
import { createMember, listMembers } from "../../services/member.js";

// After (Option E — no barrel)
import { createMember } from "../../services/member/create.js";
import { listMembers } from "../../services/member/queries.js";
```

Why: for a Bun-run API in a turbo/pnpm monorepo with explicit `.js` specifiers, barrels defeat turbo's affected-graph granularity and add no value (no client tree-shaking concern; no public API boundary). Major OSS projects (tRPC, Drizzle, Hono, Prisma, Effect) use `foo/index.ts` when they use barrels at all, never sibling `foo.ts` + `foo/`.

### Plan updates required before Task 3 dispatch

- Spec subagent brief template (`docs/superpowers/specs/2026-04-21-api-6l1q-service-refactor-design.md`): remove the "create `services/<domain>/index.ts` barrel" step; callers import from specific verb files.
- Plan Task 2 Step 9: already retroactively addressed here.
- Plan Task 17 Step 2 (ps-lg9y ESLint cap): the `ignores: ["src/services/**/index.ts"]` carve-out is now unnecessary — drop it.

### Final structure of `services/member/`

- `create.ts` (246 LOC), `queries.ts` (164), `update.ts` (91), `lifecycle.ts` (302), `internal.ts` (38).
- No barrel file.
- Full /verify green (run 30713).
