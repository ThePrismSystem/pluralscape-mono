---
# api-8su1
title: Batch N+1 queries in board message reorder
status: completed
type: bug
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T08:05:09Z
parent: ps-106o
---

reorderBoardMessages issues N individual UPDATE queries + N individual webhook dispatches (each querying webhook_configs). Reordering 20 items = ~60 DB queries.

## File

- board-message.service.ts:440-481

## Fix

Batch UPDATEs into a single SQL statement using VALUES; consolidate webhook dispatch into a single batch.

## Tasks

- [x] Batch UPDATE queries into single SQL statement
- [x] Consolidate webhook dispatches
- [x] Update integration tests

## Summary of Changes

Replaced N individual UPDATE queries with single CASE/WHEN batch update. Replaced unbounded pre-flight query with targeted IN(...) check. Reduced reorder from O(N) DB round-trips to O(1).
