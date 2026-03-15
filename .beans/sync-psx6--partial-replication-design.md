---
# sync-psx6
title: Partial replication design
status: completed
type: task
priority: normal
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-15T06:29:11Z
parent: sync-mxeg
---

Design how clients sync subsets of data (e.g., friend dashboard only syncs buckets they have access to, not the entire system). ADR 005 notes 'no built-in partial replication' as a consequence of choosing Automerge. Define the filtering/topic mechanism.

Source: Architecture Audit 004, Metric 4

## Summary of Changes

Implemented two modules for partial replication:

- **subscription-filter.ts**: `filterManifest` dispatches to owner-full (all active, archived available), owner-lite (priority-based with current-period detection and active-channel windowing), and friend (bucket-only with grant filtering) strategies. Computes evict sets from local/manifest diffs.
- **on-demand-loader.ts**: `requestOnDemandDocument` loads documents via snapshot + incremental changes through `SyncNetworkAdapter`, returns typed session with `onDemand: true` sync state.

All modules have full test coverage (30 tests across 2 test files).
