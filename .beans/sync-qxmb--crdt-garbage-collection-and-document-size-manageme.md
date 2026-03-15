---
# sync-qxmb
title: CRDT garbage collection and document size management
status: completed
type: task
priority: normal
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-15T06:29:00Z
parent: sync-mxeg
---

Design garbage collection strategy for Automerge documents. Define: when history is compacted, maximum document size before splitting, how to handle long-lived documents (e.g., chat channels with thousands of messages). ADR 005 acknowledges this need but provides no design.

Source: Architecture Audit 004, Metric 4

## Summary of Changes

Implemented three modules for CRDT garbage collection and document size management:

- **compaction.ts**: `checkCompactionEligibility` (threshold checks), `compactDocument` (snapshot creation), `LazyDocumentSizeTracker` (cached size with periodic remeasure)
- **time-split.ts**: `computeNextTimePeriod`, `computeNewDocumentId`, `checkTimeSplitEligibility`, `splitDocument` (with fronting session migration)
- **storage-budget.ts**: `checkStorageBudget`, `selectEvictionCandidates` (priority-ordered eviction, never evicts system-core/privacy-config)

All modules have full test coverage (41 tests across 3 test files).
