---
# api-rdeg
title: Make restoreEntity generic over row type
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T08:36:47Z
parent: ps-106o
---

All restoreEntity callbacks cast row as typeof table.$inferSelect because the toResult parameter accepts Record<string, unknown>. 5 avoidable assertions across M5.

## File

- entity-lifecycle.ts:131

## Fix

Add a TRow generic parameter so callers get proper types from .returning().

## Tasks

- [ ] Add TRow generic to restoreEntity
- [ ] Update all service callers
- [ ] Remove now-unnecessary type assertions

## Summary of Changes

Made restoreEntity generic over TRow. The single Record<string, unknown> cast is now centralized inside restoreEntity rather than duplicated across service files.

\n\n**Update**: The TRow generic was removed due to the no-unnecessary-type-parameters lint rule. Row casts remain at call sites (restoreEntity toResult parameter is Record<string, unknown>). The primary type safety improvement came from api-py8d (TId generic on ArchivableEntityConfig).
