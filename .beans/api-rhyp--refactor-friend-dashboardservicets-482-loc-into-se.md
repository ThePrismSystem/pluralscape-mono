---
# api-rhyp
title: Refactor friend-dashboard.service.ts (482 LOC) into services/friend-dashboard/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-22T05:58:19Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `friend-dashboard.service.ts` (~482 LOC) into `services/friend-dashboard/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/friend-dashboard/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/friend-dashboard.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/friend-dashboard.service.ts:1-482 — pure code-motion split into services/friend-dashboard/ (8 files, no barrel, max 135 LOC) — info
- apps/api/src/services/friend-dashboard/internal.ts — holds shared helpers used by >=2 verb files: cachedLoadBucketTags, queryVisibleEntities (generic), BucketTagCache, DashboardTableRef, DashboardEntityRow — info
- Table refs (MEMBER_REF, CUSTOM_FRONT_REF, STRUCTURE_ENTITY_REF) each stay local to their single-consumer verb file per Option E rule — info
- 6 test files updated: service unit test (split await-import per verb), integration test (static import), dashboard route test, dashboard-sync route test, pin route test, trpc friend router test, friend-export service test — info
- ESLint import-x/order forced getFriendDashboard import to sort before friend-dashboard-sync.service in trpc/routers/friend.ts — info
- Splitting a single await-import destructure across multiple lines caused `@typescript-eslint/no-unsafe-call` false positives in describe/it blocks — kept await-import calls on one line as workaround — low

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
