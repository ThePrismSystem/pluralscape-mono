---
# api-yvaw
title: Add friendCode tRPC router (4 procedures)
status: completed
type: feature
priority: normal
created_at: 2026-04-02T09:47:01Z
updated_at: 2026-04-16T07:29:51Z
parent: ps-n8uk
---

Create friendCodeRouter with 4 procedures matching REST /account/friend-codes/\* endpoints. Uses protectedProcedure. Procedures: generate, list, redeem, archive. See audit Domain 10.

## Summary of Changes\n\nAdded friendCodeRouter with 4 procedures to apps/api/src/trpc/routers/friend-code.ts
