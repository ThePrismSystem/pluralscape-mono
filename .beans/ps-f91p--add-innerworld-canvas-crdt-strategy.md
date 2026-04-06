---
# ps-f91p
title: Add innerworld-canvas CRDT strategy
status: completed
type: bug
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T02:44:12Z
parent: ps-y621
---

innerworld-canvas has a tRPC router, DB table, and domain type but no CRDT strategy entry. Cannot participate in offline-first sync. Blocks offline canvas editing.

Fix: add entry to packages/sync/src/strategies/crdt-strategies.ts

Audit ref: Pass 8 HIGH

## Summary of Changes\n\nAdded innerworld-canvas CRDT strategy entry, entity registry entry with id column, and exported InnerWorldCanvasId from types barrel.
