---
# api-trgr
title: Set isDev explicitly and add 422 mapping in tRPC init
status: completed
type: task
priority: normal
created_at: 2026-04-03T05:10:50Z
updated_at: 2026-04-03T06:42:46Z
---

Two related error-handling gaps:

1. initTRPC.create() has no isDev option — stack trace inclusion is non-deterministic across Bun versions. Add isDev: process.env.NODE_ENV === 'development'.

2. error-mapper.ts is missing 422/UNPROCESSABLE_CONTENT mapping — a service layer throwing status 422 falls through to INTERNAL_SERVER_ERROR. Add 422: 'UNPROCESSABLE_CONTENT'.

Files: apps/api/src/trpc/trpc.ts:12, apps/api/src/trpc/error-mapper.ts:8-17

Source: tRPC error-handling skill

## Summary of Changes\n\nAdded isDev to initTRPC.create() and 422/UNPROCESSABLE_CONTENT to error mapper.
