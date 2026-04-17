---
# sync-jj8q
title: Sync typing, performance, and patterns
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:42Z
updated_at: 2026-04-17T05:46:26Z
parent: ps-0enb
---

Low-severity sync findings from comprehensive audit.

## Findings

- [ ] [SYNC-T-L1] fieldName: string in CrdtStrategy instead of union of field names
- [ ] [SYNC-T-L2] failedConflictPersistence array not readonly
- [ ] [SYNC-P-L1] On-demand loader always fetches all changes since seq=0
- [ ] [SYNC-P-L2] Storage budget eviction sort O(n log n) on every check
- [ ] [SYNC-P-M1] SYNC_PROTOCOL_VERSION in protocol.ts instead of constants
- [ ] [SYNC-P-L3] schemas.ts and schemas/ coexist — potential import confusion
- [ ] [SYNC-TC-L1] Two setTimeout-based timing hacks in hardening tests
- [ ] [SYNC-TC-L2] Two toBeDefined() assertions without further checks

## Summary of Changes

Completed via PR #455 (`fix(sync): typing, performance, and test quality improvements`).

- Typed `CrdtStrategy.fieldName` as derived union instead of `string`
- Made `failedConflictPersistence` readonly with immutable updates
- Track `lastFetchedSeq` in on-demand loader for incremental fetching
- Cache eviction candidate sort results with invalidation
- Moved `SYNC_PROTOCOL_VERSION` to `sync.constants.ts`; renamed `schemas.ts` → `schema-registry.ts`
- Replaced `setTimeout` timing hacks with vitest fake timers; strengthened assertions
