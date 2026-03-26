---
# api-ngdo
title: Fix Record<string, unknown> in updateBoardMessage set values
status: completed
type: bug
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T08:02:59Z
parent: ps-106o
---

updateBoardMessage builds setValues as Record<string, unknown>, erasing column type safety on the Drizzle .set() call.

## File

- board-message.service.ts:233

## Fix

Use Partial<Pick<NewBoardMessage, 'encryptedData' | 'updatedAt' | 'sortOrder' | 'pinned'>> & { version: SQL }.

## Tasks

- [ ] Replace Record<string, unknown> with proper typed partial
- [ ] Verify typecheck passes

## Summary of Changes

Replaced Record<string, unknown> type annotation with properly typed object construction in updateBoardMessage, keeping the Drizzle cast at the .set() boundary only.
