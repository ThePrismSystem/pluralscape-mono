---
# ps-wxn7
title: Normalize query key naming convention
status: completed
type: task
priority: normal
created_at: 2026-04-06T00:52:54Z
updated_at: 2026-04-06T05:12:29Z
parent: ps-y621
---

Three conventions coexist: snake_case (fronting_sessions, custom_fronts), kebab-case (innerworld-entities, lifecycle-events), and camelCase (boardMessages). Majority use bare plural nouns.

Pick one convention and apply consistently across all hooks.

Audit ref: Pass 5 MEDIUM

## Summary of Changes\n\nNormalized 6 query keys from kebab-case/camelCase to snake_case across 5 hook files.
