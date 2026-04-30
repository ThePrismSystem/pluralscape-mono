---
# ps-vrac
title: "T2 import-sp test split: engine/import-engine.test.ts"
status: todo
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T05:02:12Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

One file in packages/import-sp.

## Files

- [ ] engine/import-engine.test.ts (1,150) — split by SP-specific phase (auth, fetch, mapping, persist)

## Acceptance

- pnpm vitest run --project import-sp passes
- Coverage unchanged or higher

## Out of scope

- import-sp engine changes
- Live API tests (gated behind SP_TEST_LIVE_API)
