---
# types-jmk7
title: Shared brandId<T> utility for Drizzle inferSelect to branded ID casts
status: completed
type: task
priority: normal
created_at: 2026-03-26T12:23:26Z
updated_at: 2026-04-17T05:46:18Z
parent: ps-0enb
---

Extract a reusable brandId<T> helper to replace ~76 'row.id as XxxId' type assertions across 7 M5 services. Compile-time only benefit. Deferred from M5 audit (L7).

## Summary of Changes

Completed via PR #453. Introduced `brandId<T>()` utility at `packages/types/src/brand-utils.ts` and replaced 228 `as XxxId` casts across 65 service files. Verified: 294 `brandId` call sites across `apps/api/src/services/`.
