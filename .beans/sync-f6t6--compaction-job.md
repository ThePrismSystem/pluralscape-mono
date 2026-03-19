---
# sync-f6t6
title: Compaction job
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
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
