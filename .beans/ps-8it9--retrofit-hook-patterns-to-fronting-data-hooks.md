---
# ps-8it9
title: Retrofit hook patterns to fronting data hooks
status: completed
type: task
priority: normal
created_at: 2026-04-03T22:53:13Z
updated_at: 2026-04-04T05:00:32Z
parent: ps-0ph3
---

Add onError + enabled to subscription hooks, useCallback-wrapped select to CRUD hooks. Entities: fronting sessions, fronting comments, fronting reports, fronting analytics, timer/check-in.

## Summary of Changes

Wrapped all inline `select` callbacks in `useCallback([masterKey])` across 4 fronting hook files: use-fronting-sessions, use-fronting-comments, use-fronting-reports, use-timer-check-in. Extracted `useActiveFronters` selector and `useCheckInHistory` selector (no crypto deps).
