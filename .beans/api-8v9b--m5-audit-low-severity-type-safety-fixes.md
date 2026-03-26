---
# api-8v9b
title: M5 audit low-severity type safety fixes
status: todo
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T07:43:55Z
parent: ps-106o
---

Batch of low-severity type safety findings from M5 audit.

## Tasks

- [ ] L6: Use narrowing guard instead of type assertion in togglePinned (board-message.service.ts:377)
- [ ] L7: Consider shared brandId<T> utility for Drizzle inferSelect to branded ID casts (systemic, 6 services)
- [ ] L8: Reorder webhook dispatch calls to use already-branded result IDs instead of re-casting
- [ ] L9: Use branded ID keys in CRDT sync schema Record types (optional)
