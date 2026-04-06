---
# ps-pejm
title: Extract hook factories (useOfflineFirstQuery, useOfflineFirstInfiniteQuery, useDomainMutation)
status: completed
type: task
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T02:44:11Z
parent: ps-y621
---

Extract generic hook factories from the repeated ~40-line dual-source scaffold across 20+ hook files (~5,000 lines). Three factories needed:

- useOfflineFirstQuery: single-entity get with local/remote branching, masterKey select transform, enabled guard
- useOfflineFirstInfiniteQuery: list queries with pagination, same dual-source pattern
- useDomainMutation: mutation with useActiveSystemId + trpc.useUtils + onSuccess invalidation

Refactor all existing hooks to use the new factories. This must happen BEFORE adding missing hooks (prevents boilerplate growth).

Audit ref: Pass 6 HIGH, Cross-Cutting Theme #1

## Summary of Changes\n\nExtracted useOfflineFirstQuery, useOfflineFirstInfiniteQuery, useDomainMutation factories in factories.ts. Refactored 30+ existing hooks to use factories, eliminating ~900 lines of boilerplate.
