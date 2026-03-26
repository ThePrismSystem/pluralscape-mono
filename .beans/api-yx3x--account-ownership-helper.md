---
# api-yx3x
title: Account ownership helper
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:42Z
updated_at: 2026-03-26T23:24:53Z
parent: api-rl9o
---

Implement assertAccountOwnership(accountId, auth) for account-level friend operations per ADR 021. withAccountTransaction(db, { accountId }, fn) for account-level RLS context. Files: apps/api/src/lib/account-ownership.ts (new, or extend rls-context.ts). Note: withAccountRead already exists — verify and extend.

## Summary of Changes\n\nCreated apps/api/src/lib/account-ownership.ts with assertAccountOwnership(accountId, auth) that throws 404 NOT_FOUND on mismatch (mirrors assertSystemOwnership pattern). Verified withAccountTransaction/withAccountRead already exist in rls-context.ts. Full unit test coverage.
