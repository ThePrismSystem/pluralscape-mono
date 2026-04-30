---
# crypto-mdzz
title: "T2 crypto test split: key-lifecycle.test.ts"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T18:32:18Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

One file in packages/crypto.

## Files

- [x] key-lifecycle.test.ts (1,021)

## Acceptance

- pnpm vitest run --project crypto passes
- Coverage unchanged or higher

## Summary of Changes

Split `packages/crypto/src/__tests__/key-lifecycle.test.ts` (1,021 LOC, 68 tests) into 4 focused files plus shared fixtures:

- `key-lifecycle-unlock.test.ts` (322 LOC, 23 tests) — initial state, `unlockWithPassword`, `unlockWithBiometric`, `SECURITY_PRESETS`
- `key-lifecycle-lock.test.ts` (310 LOC, 20 tests) — `lock`, clearing order, `logout`
- `key-lifecycle-timers.test.ts` (307 LOC, 19 tests) — grace period and inactivity timer behaviour
- `key-lifecycle-bucket-keys.test.ts` (154 LOC, 6 tests) — `getBucketKey` cache, error paths
- `helpers/key-lifecycle-fixtures.ts` (55 LOC) — shared `STANDARD_CONFIG`, `TEST_PASSWORD`, `KEY_VERSION_1`, `createWrappedMasterKey`, `makeDeps`

All 68 tests preserved (count unchanged). All resulting test files <=325 LOC. `pnpm vitest run --project crypto` passes (842 tests across 49 files in the crypto project). `pnpm typecheck`, `pnpm lint`, `pnpm format` all clean.
