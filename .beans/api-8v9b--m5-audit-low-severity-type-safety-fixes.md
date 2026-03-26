---
# api-8v9b
title: M5 audit low-severity type safety fixes
status: completed
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T12:23:37Z
parent: ps-106o
---

Batch of low-severity type safety findings from M5 audit.

## Tasks

- [x] L6: Use narrowing guard instead of type assertion in togglePinned (board-message.service.ts:377)
- [x] L7: Deferred to types-jmk7
- [x] L8: Reorder webhook dispatch calls to use already-branded result IDs instead of re-casting
- [x] L9: Deferred to sync-sqfo

## Summary of Changes

- Replaced type assertion in togglePinned with narrowing guard
- Reordered webhook dispatch calls in 6 services (note, board-message, poll, poll-vote, acknowledgement, channel) to build result first, then use branded ID from result
- Deferred L7 (brandId utility) to types-jmk7 and L9 (CRDT branded keys) to sync-sqfo
