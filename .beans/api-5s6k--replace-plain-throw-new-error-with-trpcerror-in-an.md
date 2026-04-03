---
# api-5s6k
title: Replace plain throw new Error with TRPCError in analytics router
status: completed
type: bug
priority: high
created_at: 2026-04-03T05:10:39Z
updated_at: 2026-04-03T06:42:46Z
---

analytics.ts:80 throws a plain Error for an invariant violation. tRPC wraps it as INTERNAL_SERVER_ERROR without a meaningful code. Replace with `throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '...' })`.

File: apps/api/src/trpc/routers/analytics.ts:80

Source: tRPC error-handling skill — throw TRPCError not plain Error

## Summary of Changes\n\nReplaced throw new Error with throw new TRPCError in analytics.ts.
