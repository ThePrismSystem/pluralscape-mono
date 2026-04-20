---
# mobile-76ql
title: Scope search:index-updated invalidation instead of nuking all
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: mobile-e3l7
---

Finding [PERF-2] from audit 2026-04-20. apps/mobile/src/data/query-invalidator.ts:31. Every materialized document fires search:index-updated, nuking all ['search', ...] entries regardless of scope. Fix: scope invalidation by entity type or search query text.
