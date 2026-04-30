---
# api-4cmq
title: "T2 api ws+trpc test splits: 4 files (investigate ws/handlers dup)"
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

Four files in apps/api WS + tRPC layer. Investigate and resolve the two ws/handlers.test.ts duplicates as part of this PR.

## Files

- [ ] **tests**/ws/handlers.test.ts (1,042) — investigate vs the second handlers.test.ts; dedupe if confirmed duplicate
- [ ] ws/**tests**/handlers.test.ts (928) — investigate vs first
- [ ] **tests**/ws/message-router.test.ts (1,406)
- [ ] **tests**/trpc/routers/structure.test.ts (875)

## Acceptance

- pnpm vitest run --project api passes
- Duplicate handlers.test.ts resolved with explanation in PR description

## Out of scope

- WS protocol changes, tRPC router changes
