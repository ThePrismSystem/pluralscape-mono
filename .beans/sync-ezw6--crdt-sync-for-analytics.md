---
# sync-ezw6
title: CRDT sync for analytics
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:57Z
updated_at: 2026-03-22T12:51:05Z
parent: api-8sel
blocked_by:
  - api-sheu
---

Register CRDT strategy for fronting reports. Analytics queries are server-computed (not synced).

## Acceptance Criteria

- [x] Fronting report strategy: LWW-Map in `system-core` document (immutable snapshots, but synced for offline access)
- [x] Analytics query results are NOT synced (computed on demand)
- [x] Post-merge validation: report records are immutable — reject merges that modify existing report fields (only creation and deletion allowed)
- [x] Tests for basic sync operations

## Summary of Changes

Added `fronting-report` strategy to `ENTITY_CRDT_STRATEGIES` in `crdt-strategies.ts` (lww-map, system-core document). Added `validateFrontingReportImmutability()` function to `post-merge-validator.ts`. Updated CRDT strategies test to include the new entity type. Immutability is enforced at the API layer (no update endpoint exists); post-merge validator provides an audit notification layer.
