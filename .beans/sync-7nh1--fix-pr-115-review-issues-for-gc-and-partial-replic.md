---
# sync-7nh1
title: "Fix PR #115 review issues for GC and partial replication"
status: completed
type: task
priority: high
created_at: 2026-03-15T06:50:19Z
updated_at: 2026-04-16T07:29:41Z
parent: sync-xlhb
---

Address 2 critical, 5 important, and 4 suggestion-level issues from multi-agent review of PR #115 (feat/sync-gc-partial-replication). 11 steps across time-split, on-demand-loader, storage-budget, subscription-filter, types, and compaction modules.

## Summary of Changes

### Critical fixes

- **Step 1**: Strengthened `isFrontingDocument` guard to check all 4 fields (sessions, switches, comments, checkInRecords). Inverted the guard in `splitDocument` to throw on mismatch instead of silently returning an empty doc.
- **Step 2**: Added JSDoc explaining why `lastSyncedSeq=0` is intentional and safe for snapshot-loaded on-demand docs. Added idempotency test proving overlapping changes don't duplicate data.

### Important fixes

- **Step 3**: Replaced `as unknown as T` double-hop cast with single `as Automerge.Doc<T>` cast from the concrete union return type.
- **Step 4**: Replaced non-exhaustive `switch/default:break` with const lookup map `HISTORICAL_CATEGORY` for cleaner eviction category resolution.
- **Step 5**: Wrapped `parseDocumentId` calls in `selectEvictionCandidates`, `filterOwnerLite`, and `latestTimePeriodByType` with try-catch to silently skip malformed entries.
- **Step 6**: Added comment explaining why lexicographic comparison is correct for time period formats.

### Suggestions implemented

- **Step 7**: Changed `CompactionCheck` from flat interface to discriminated union on `eligible`.
- **Step 8**: Changed `TimeSplitResult` from interface to discriminated union with `documentType` field, eliminating casts in consumer code.
- **Step 9**: Extracted `resolveTimeSplitConfig` helper, deleted `SPLITTABLE_TYPES` set, simplified `checkTimeSplitEligibility` and `splitDocument`.
- **Step 10**: Removed `compactDocument` wrapper function; callers use `session.createSnapshot()` directly.
- **Step 11**: Added tests for adapter error propagation, fresh chat session, overlapping changes idempotency, malformed docIds, empty manifests, empty grantedBucketIds, all-protected-over-budget, and chat time-split edge cases.
