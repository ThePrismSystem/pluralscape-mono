---
# ps-qcil
title: Remove redundant 'as const' on DEFAULT_COMPACTION_CONFIG
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:01:43Z
parent: ps-i3xl
---

types.ts:56, cosmetic

## Summary of Changes\n\nRemoved redundant `as const` from DEFAULT_COMPACTION_CONFIG — the object is already typed as CompactionConfig with readonly fields.
