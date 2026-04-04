---
# ps-g6co
title: Retrofit hook patterns to identity data hooks
status: completed
type: task
priority: normal
created_at: 2026-04-03T22:53:13Z
updated_at: 2026-04-04T05:00:26Z
parent: ps-s6nr
---

Add onError + enabled to subscription hooks, useCallback-wrapped select to CRUD hooks. Entities: members, groups, custom fields, custom fronts, system settings.

## Summary of Changes

Wrapped all inline `select` callbacks in `useCallback([masterKey])` across 5 identity hook files: use-members, use-groups, use-custom-fields, use-custom-fronts, use-system-settings. Memoizes selector functions to prevent unnecessary re-renders when parent components update.
