---
# api-trlq
title: Refactor member.service.ts (840 LOC) into services/member/
status: todo
type: task
created_at: 2026-04-21T13:56:35Z
updated_at: 2026-04-21T13:56:35Z
parent: api-6l1q
---

Split apps/api/src/services/member.service.ts (840 LOC) into apps/api/src/services/member/ with per-verb files, each ≤300 LOC. Largest god-file in the service layer.

## Context

Currently concentrates create / update / archive / restore / duplicate / ownership checks / permission dispatch in a single file. The ownership and permission logic is reused across sibling services; extracting to a shared permissions.ts makes the pattern copyable for subsequent refactors.

## Scope

- [ ] Create apps/api/src/services/member/ directory
- [ ] Split into files by verb: create.ts, update.ts, archive.ts, restore.ts, duplicate.ts, queries.ts, permissions.ts (and an index.ts re-exporter so caller imports stay stable)
- [ ] Keep existing public exports identical — no caller edits needed
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC

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
