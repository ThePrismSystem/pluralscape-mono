---
# mobile-jxox
title: "T2 mobile test splits: row-transforms, factories, SyncProvider, opfs-worker, trpc-persister-api, import.hooks"
status: todo
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T05:02:13Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Six files in apps/mobile.

## Files

- [ ] data/row-transforms.test.ts (2,011)
- [ ] **tests**/factories.ts (909) helper — split by entity factory family
- [ ] sync/SyncProvider.test.tsx (993)
- [ ] platform/drivers/opfs-worker.test.ts (857)
- [ ] features/import-sp/trpc-persister-api.test.ts (1,213)
- [ ] features/import-sp/import.hooks.test.tsx (757)

## Acceptance

- pnpm vitest run --project mobile passes
- Coverage unchanged or higher
