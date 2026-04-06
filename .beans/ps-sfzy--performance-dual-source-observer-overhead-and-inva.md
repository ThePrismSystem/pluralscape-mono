---
# ps-sfzy
title: "Performance: dual-source observer overhead and invalidation breadth"
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:46Z
updated_at: 2026-04-06T09:45:50Z
parent: ps-y621
---

Architectural notes for future optimization (not blocking):

1. Every dual-source hook registers 2x query observers (local + remote, one disabled). Inherent to pattern but could be reduced with single useQuery + dynamic queryFn.

2. query-invalidator.ts materialized:document handler invalidates by [tableName] prefix — marks ALL queries for that table stale. Acceptable for local SQLite reads but could cascade in high-frequency sync.

3. masterKey change (rotation) recreates all select callbacks simultaneously. One-time cost per rotation.

4. use-friend-export.ts etagRef is per-component-instance, lost on unmount.

Audit ref: Pass 3 MEDIUM + LOW

## Summary of Changes

Added architecture notes block in hooks/factories.ts documenting: dual observer overhead, invalidation breadth, key rotation callback cost, and etagRef per-instance lifecycle.
