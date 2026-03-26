---
# api-vxzd
title: Extract pagination helper to reduce list boilerplate
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:21:57Z
parent: ps-106o
---

The effectiveLimit calculation, fetch-one-extra pattern, cursor construction, and result slicing are duplicated verbatim across 5+ list functions (~15 lines each).

## Fix

Extract a paginatedQuery helper that encapsulates the common pattern.

## Tasks

- [ ] Create paginatedQuery helper
- [ ] Refactor M5 list functions to use helper
- [ ] Verify integration tests still pass

## Summary of Changes\n\nExtracted buildCompositePaginatedResult helper in pagination.ts. Refactored 6 M5 services (note, poll, poll-vote, acknowledgement, message, board-message) to use it, replacing 5 duplicated lines per service with a single call.
