---
# sync-tf2p
title: Document lifecycle management
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:36:08Z
updated_at: 2026-03-15T01:01:45Z
parent: sync-xlhb
---

Document garbage collection, compaction, and size management

## Scope

- Automerge document compaction: create snapshots every 200-500 changes (app-layer, Automerge has no built-in GC)
- Maximum document size thresholds (measure and set limits)
- Document splitting strategy: e.g., chat history by time range (monthly/quarterly docs)
- Purging old sync state: remove stale change history after compaction
- Storage budget: per-system limits to prevent unbounded growth
- Archive strategy: cold storage for old documents

## Acceptance Criteria

- [ ] Compaction strategy: snapshot interval defined (200-500 changes)
- [ ] Document size limits documented
- [ ] Splitting strategy for growing documents (chat)
- [ ] Purge strategy for post-compaction cleanup
- [ ] Storage budget per system
- [ ] Integration test: compaction reduces document size

## Research Notes

- Automerge has no built-in GC — must implement app-layer compaction
- Snapshots replace full history with a single state

## References

- ADR 005

## Summary of Changes

- Created packages/sync/docs/document-lifecycle.md: 8 sections covering compaction strategy, document size management, time-split implementation, purging, storage budget, archive/cold storage, and decision log
- Added types to packages/sync/src/types.ts: CompactionConfig, DEFAULT_COMPACTION_CONFIG, TimeSplitUnit, TimeSplitConfig, TIME_SPLIT_CONFIGS, DOCUMENT_SIZE_LIMITS, StorageBudget, DEFAULT_STORAGE_BUDGET, SYNC_PRIORITY_ORDER, CompactionCheck, StorageBudgetExceededError
- Created packages/sync/src/**tests**/document-lifecycle.test.ts: 25 tests covering compaction (8), time-split (6), purging (4), storage budget (3), archive (4)
