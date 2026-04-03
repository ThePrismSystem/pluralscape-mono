---
# api-joyk
title: Extract createContextInner for server-side callers and tests
status: completed
type: task
priority: normal
created_at: 2026-04-03T05:10:46Z
updated_at: 2026-04-03T06:42:46Z
---

createTRPCContext requires a Hono Context<AuthEnv> object. No createContextInner variant exists for tests/server-side callers without HTTP objects. Tests work around this with manual TRPCContext construction and db stubs.

Extract createTRPCContextInner({ db, auth, requestMeta }) and have createTRPCContext call it.

File: apps/api/src/trpc/context.ts:36

Source: tRPC server-setup skill — inner/outer context split

## Summary of Changes\n\nExtracted createTRPCContextInner, updated test helpers with Proxy db stub, added JSDoc for getHTTPStatusCodeFromError.
