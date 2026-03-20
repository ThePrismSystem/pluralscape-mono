---
# sync-f6t6
title: Compaction job
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T01:55:50Z
parent: sync-qxxo
---

Wire existing compaction logic (\`packages/sync/src/compaction.ts\`) into a background job that triggers at snapshot threshold.

## Acceptance Criteria

- Creates snapshot from current Automerge doc state at configured change threshold
- Submits snapshot via relay's submitSnapshot
- Prunes local changes below snapshot version
- Storage budget check blocks snapshot submit when quota exceeded
- Configurable threshold in constants file
- Unit tests for threshold trigger and prune-after-snapshot flow

## Summary of Changes

- Added `sync-compaction` to JobType union and JobPayloadMap in types package
- Added sync-compaction retry policy in queue package
- Created handleCompaction() in packages/sync/src/engine/compaction-handler.ts
- Checks eligibility, storage budget, creates snapshot, submits to relay, prunes old changes
- Added compactionIdempotencyKey() helper
- 7 tests covering threshold triggers, budget blocking, relay submission, idempotency keys
