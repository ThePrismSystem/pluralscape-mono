---
# ps-w5o7
title: Search hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:39Z
updated_at: 2026-04-05T05:51:30Z
parent: ps-vegi
---

FTS5 index management, query execution, result ranking

Uses trpc.system.search for query execution and result ranking. FTS5 index is local SQLite.

## Summary of Changes

Implemented useSearch hook and executeSearch function with FTS5-backed local search across all entity types for both self and friend data. Supports scope filtering (self/friends/all), prefix matching, bm25 ranking, and debounced input.
