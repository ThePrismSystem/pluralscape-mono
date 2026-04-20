---
# mobile-76ql
title: Scope search:index-updated invalidation instead of nuking all
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T19:00:04Z
parent: mobile-e3l7
---

Finding [PERF-2] from audit 2026-04-20. apps/mobile/src/data/query-invalidator.ts:31. Every materialized document fires search:index-updated, nuking all ['search', ...] entries regardless of scope. Fix: scope invalidation by entity type or search query text.

## Summary of Changes

Scoped the search:index-updated invalidation by the event's `scope` (`self` | `friend`) in apps/mobile/src/data/query-invalidator.ts. Previously every search index update blanket-invalidated all `["search", …]` queries regardless of scope; now a predicate matches the third key slot (scope) against the event scope so a self-scope materialization no longer purges friend search caches (and vice versa).

Keys lacking the scope slot (e.g., a bare `["search"]` entry) fall through the predicate and stay cached.

Tests: replaced the two scope-agnostic assertions with three cases covering predicate shape, per-scope match/reject behavior, and the friend-scope ↔ self-scope isolation invariant.
