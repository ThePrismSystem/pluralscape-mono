---
# mobile-jxox
title: "T2 mobile test splits: row-transforms, factories, SyncProvider, opfs-worker, trpc-persister-api, import.hooks"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T12:33:20Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Six files in apps/mobile.

## Files

- [x] data/row-transforms.test.ts (2,011)
- [x] **tests**/factories.ts (909) helper — split by entity factory family
- [x] sync/SyncProvider.test.tsx (993)
- [x] platform/drivers/opfs-worker.test.ts (857)
- [x] features/import-sp/trpc-persister-api.test.ts (1,213)
- [x] features/import-sp/import.hooks.test.tsx (757)

## Acceptance

- pnpm vitest run --project mobile passes
- Coverage unchanged or higher

## Summary of Changes

Split all 6 oversized mobile test/helper files into smaller focused files by concern:

- `factories.ts` → 6 factory subfiles under `factories/` + barrel `index.ts`; updated 23 consumer test files to new import path
- `row-transforms.test.ts` → 5 files by entity group under `data/__tests__/row-transforms/`
- `SyncProvider.test.tsx` → `SyncProvider-lifecycle.test.tsx` (auth + bootstrap errors) + `SyncProvider-pipeline.test.tsx` (pipeline init + materializer wiring); full `vi.mock` setup block duplicated in each
- `opfs-worker.test.ts` → `opfs-worker-dispatch.test.ts` (dispatch ops) + `opfs-worker-panic.test.ts` (global panic listeners)
- `trpc-persister-api.test.ts` → `trpc-persister-api-core.test.ts` (system/settings/bucket/field/member/fronting/note) + `trpc-persister-api-comms.test.ts` (poll/channel/message/boardMessage/group/blob/importEntityRef)
- `import.hooks.test.tsx` → `import.hooks-start-resume.test.tsx` + `import.hooks-query-cancel.test.tsx`

All 6 originals deleted. 125 test files, 1366 tests pass. Format, lint, typecheck all clean.
