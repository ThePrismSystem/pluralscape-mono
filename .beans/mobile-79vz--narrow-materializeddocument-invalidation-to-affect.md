---
# mobile-79vz
title: Narrow materialized:document invalidation to affected keys
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T18:58:55Z
parent: mobile-e3l7
---

Finding [PERF-1] from audit 2026-04-20. apps/mobile/src/data/query-invalidator.ts:22. invalidateQueries({ queryKey: [tableName] }) marks every cached query stale on every sync document event. Cascades in high-frequency scenarios. Fix: narrow invalidation when document type maps 1:1 to entity ID, similar to per-entity path at line 28.

## Summary of Changes

Narrowed the materialized:document invalidation path in apps/mobile/src/data/query-invalidator.ts to distinguish hot-path from non-hot-path entity types:

- Hot-path entity types (fronting, chat, reactions, …) also emit per-entity materialized:entity events that already precisely invalidate detail queries (`[tableName, entityId]`). The document event now invalidates only list-shaped queries (`[tableName, "list", …]`) via a predicate that matches the `"list"` discriminator, leaving individual detail caches to the entity path.
- Non-hot-path entity types never emit materialized:entity events, so the document event preserves the broad `[tableName]` invalidation for them (correctness fallback).

Added unit tests asserting: non-hot-path documents fire without a predicate; hot-path documents fire with a predicate that accepts `[tableName, "list", …]` keys and rejects `[tableName, entityId]` detail keys on the same table.
