---
# api-sgng
title: Refactor device-token.service.ts (302 LOC) into services/device-token/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:11Z
updated_at: 2026-04-21T23:41:08Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `device-token.service.ts` (~302 LOC) into `services/device-token/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope
- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/device-token/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/device-token.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance
- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/device-token.service.ts:58 — `hashDeviceToken` is publicly exported but was defined alongside internal helpers in the monolith; relocated to `device-token/internal.ts` and re-exported via verb files that need it (register, update) — info
- apps/api/src/services/device-token.service.ts:33-42 — Audit event constants (`AUDIT_TOKEN_REGISTERED`, `_UPDATED`, `_REVOKED`, `_DELETED`) each had a single consumer; inlined into their respective verb files per Option E single-consumer rule — info
- apps/api/src/__tests__/routes/device-tokens/{crud,update-delete}.test.ts — `vi.mock` previously targeted the single service module; after split each verb path now has its own `vi.mock` call plus a dedicated dynamic `await import`. Same adjustment applied to `trpc/routers/device-token.test.ts` (which silently relied on the original module mocking `updateDeviceToken` transitively) — info
- apps/api/src/__tests__/trpc/routers/device-token.test.ts — The original mock did not include `updateDeviceToken` even though the router imports it; added a mock for `device-token/update.js` to preserve hermetic behavior post-split — low
