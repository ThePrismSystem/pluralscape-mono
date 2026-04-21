---
# api-uefd
title: Refactor import-job.service.ts (445 LOC) into services/system/import-jobs/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-21T23:31:13Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `import-job.service.ts` (~445 LOC) into `services/system/import-jobs/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: intra-PR-2 nest under services/system/

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/system/import-jobs/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/import-job.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/system/import-jobs/update.ts:135 — pre-existing cast `parsed.errorLog as readonly ImportError[] | null` preserved from original file; not new code — low
- No circular imports; single-direction: verbs → internal — info
- update.ts is the largest split file at 172 LOC (167 after prettier), well under 300 target — info
