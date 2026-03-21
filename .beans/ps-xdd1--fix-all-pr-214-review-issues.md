---
# ps-xdd1
title: Fix all PR 214 review issues
status: completed
type: task
priority: normal
created_at: 2026-03-21T01:03:13Z
updated_at: 2026-03-21T01:07:52Z
---

Fix 2 critical, 6 important, and 4 suggestion-level issues from PR review of refactor/audit-sync-engine

## Summary of Changes

- Extracted `mapConcurrent` to shared `map-concurrent.ts` module, replacing unsafe `mapConcurrentReplay` (Critical #2, Important #3)
- Wrapped each validator in `runAllValidations` with independent try/catch via `onError` callback (Critical #1)
- Extracted `submitCorrectionEnvelopes` as standalone two-phase function (Important #4, Suggestion #11)
- Removed redundant `tombstoneNotifications` from `PostMergeValidationResult` (Important #5)
- Fixed jitter constants: split into `JITTER_MIN`/`JITTER_MAX` (Important #6)
- Added upper-bound assertion and gate pattern to concurrency test (Important #7, #8)
- Removed duplicate `DocumentReplayResult` type (Suggestion #9)
- Fixed `MiB = KiB * KiB` to `KiB * 1024`, exported base units (Suggestions #10, #12)
