---
# api-3nko
title: "Audit: performance bottlenecks and optimization"
status: completed
type: task
priority: normal
created_at: 2026-03-30T21:11:15Z
updated_at: 2026-03-31T01:50:27Z
parent: api-e7gt
---

Audit API for performance issues: slow queries, missing indexes, unnecessary allocations, N+1 patterns, and optimization opportunities.

## Summary of Changes

### Fixed

- Batched key-rotation item status updates: replaced N individual UPDATEs with 2 batched queries (completed + pending/failed), reducing round-trips within the transaction.

### Assessed — No Action Needed

- Webhook dispatch in friend-connection.service.ts: sequential within DB transaction, parallelization would not help (PG serializes within tx).
- System query in session-auth.ts: unbounded but accounts have 1-2 systems. Adding LIMIT would break multi-system accounts.
- Co-fronting analytics O(n^2): bounded by MAX_ANALYTICS_SESSIONS (10,000) with early-break optimization. Adequate for domain.
- All list endpoints use parsePaginationLimit with proper defaults and max bounds.
