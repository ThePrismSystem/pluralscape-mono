---
# api-3d0y
title: Remove redundant auth check in system middleware
status: completed
type: task
priority: low
created_at: 2026-04-03T05:11:02Z
updated_at: 2026-04-03T06:42:47Z
---

system.ts:15-17 — enforceSystemAccess re-checks ctx.auth which is already guaranteed non-null by protectedProcedure. Remove the redundant if (!ctx.auth) block.

File: apps/api/src/trpc/middlewares/system.ts:15-17

Source: tRPC middlewares skill audit

## Summary of Changes\n\nRemoved redundant if (!ctx.auth) check in system middleware.
