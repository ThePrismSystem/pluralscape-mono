---
# api-yx3x
title: Account ownership helper
status: todo
type: feature
created_at: 2026-03-26T16:03:42Z
updated_at: 2026-03-26T16:03:42Z
parent: api-rl9o
blocked_by:
  - api-rl9o
---

Implement assertAccountOwnership(accountId, auth) for account-level friend operations per ADR 021. withAccountTransaction(db, { accountId }, fn) for account-level RLS context. Files: apps/api/src/lib/account-ownership.ts (new, or extend rls-context.ts). Note: withAccountRead already exists — verify and extend.
