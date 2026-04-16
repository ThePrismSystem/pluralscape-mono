---
# api-i6ms
title: Add errorFormatter for Zod field-level validation errors
status: completed
type: bug
priority: high
created_at: 2026-04-03T05:10:36Z
updated_at: 2026-04-16T07:29:52Z
parent: ps-7j8n
---

initTRPC.create() in trpc.ts has no errorFormatter. Clients receive generic validation messages without field-level details. Must add errorFormatter that checks `error.cause instanceof ZodError` and returns `error.cause.flatten()` in `shape.data.zodError`.

File: apps/api/src/trpc/trpc.ts:12

Source: tRPC error-handling skill — Zod errorFormatter pattern

## Summary of Changes\n\nAdded errorFormatter to initTRPC.create() using z.treeifyError() for Zod v4 field-level validation details.
