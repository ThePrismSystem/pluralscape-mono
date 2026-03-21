---
# types-ok7n
title: Replace 'as UnixMillis' casts with helper function
status: completed
type: task
priority: normal
created_at: 2026-03-17T08:17:57Z
updated_at: 2026-03-21T11:22:35Z
parent: api-0zl4
---

Codebase-wide refactor: introduce a typed helper (e.g. toUnixMillis) to replace raw 'as UnixMillis' casts. Deferred from PR #152 review (S3).

## Summary of Changes\n\nAdded `toUnixMillis()` and `toUnixMillisOrNull()` helpers to `packages/types/src/timestamps.ts`. Replaced all 168 `as UnixMillis` casts across 65 files with the new helpers. Exported both from package index.
