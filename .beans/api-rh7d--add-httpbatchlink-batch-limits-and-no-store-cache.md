---
# api-rh7d
title: Add httpBatchLink batch limits and no-store cache header
status: completed
type: task
priority: normal
created_at: 2026-04-03T05:10:59Z
updated_at: 2026-04-16T07:29:53Z
parent: ps-7j8n
---

Three related client/server hardening items:

1. Mobile trpc-provider.tsx and E2E trpc.fixture.ts httpBatchLink have no maxURLLength/maxItems — defaults are Infinity, risking 413/414 errors. Add maxURLLength: 2083, maxItems: 10.

2. Also update httpBatchLink headers signature from async () => to async ({ opList }) => for correctness.

3. Add responseMeta to fetchRequestHandler in routes/trpc.ts to set Cache-Control: no-store on all tRPC responses (matching REST pattern for authenticated endpoints).

Files: apps/mobile/src/providers/trpc-provider.tsx, apps/api-e2e/src/fixtures/trpc.fixture.ts, apps/api/src/routes/trpc.ts

Source: tRPC links skill, caching skill

## Summary of Changes\n\nAdded maxURLLength/maxItems to httpBatchLink, responseMeta no-store, loggerLink, headers function conversion.
